import { BINARY_CONTENT_TYPES, CONFIG, MESSAGE_TYPES } from "../constants";
import type { TInterceptedRequest, TMock } from "../types";
import { MockManager } from "./MockManager";
import { createRequest, postMessageBatched } from "./messaging";
import {
	cleanupUrlCache,
	createSafeJsonResponse,
	getStatusText,
	shouldIgnoreUrl,
} from "./utils";

export class RequestInterceptor {
	private mockManager = new MockManager();
	private originalFetch = window.fetch;
	private originalXHR = window.XMLHttpRequest;

	constructor() {
		this.setupMessageListener();
		this.interceptFetch();
		this.interceptXHR();

		setInterval(() => this.cleanupCaches(), 300000);
	}

	private cleanupCaches(): void {
		cleanupUrlCache();
		MockManager.cleanupCaches();
	}

	private setupMessageListener(): void {
		window.addEventListener("message", (event) => {
			if (event.source !== window) return;
			if (event.data.type === MESSAGE_TYPES.MOCKS_UPDATE) {
				this.mockManager.updateMocks(event.data.mocks || []);
			}
		});
	}

	private shouldLogRequest(url: string): boolean {
		return !shouldIgnoreUrl(url);
	}

	private createResponse(
		data: Partial<TInterceptedRequest>,
	): TInterceptedRequest {
		const request = createRequest();
		Object.assign(request, data);
		request.timestamp = Date.now();
		return request;
	}

	private async createMockResponse(mock: TMock): Promise<Response> {
		const headers = new Headers({ "Content-Type": "application/json" });

		if (mock.headers) {
			for (const [name, value] of Object.entries(mock.headers)) {
				headers.set(name, value);
			}
		}

		const responseBody =
			typeof mock.response === "string"
				? mock.response
				: JSON.stringify(mock.response);

		const status = mock.statusCode || 200;

		if (mock.delay && mock.delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, mock.delay));
		}

		return new Response(responseBody, {
			status,
			statusText: getStatusText(status),
			headers,
		});
	}

	private async readResponseBody(response: Response): Promise<string> {
		try {
			if (
				!response.body ||
				response.status === 204 ||
				response.status === 304
			) {
				return "{}";
			}

			const contentType = response.headers.get("content-type") || "";

			if (BINARY_CONTENT_TYPES.some((type) => contentType.includes(type))) {
				return `{"type":"binary","contentType":"${contentType}","message":"Binary content"}`;
			}

			const text = await response.text();
			if (!text.trim()) return "{}";

			return createSafeJsonResponse(
				text,
				contentType.includes("application/json") ? "json" : "text",
			);
		} catch (error) {
			return `{"type":"error","message":"${(error as Error).message}"}`;
		}
	}

	private interceptFetch(): void {
		const self = this;

		window.fetch = async function (...args: Parameters<typeof fetch>) {
			const [input, init = {}] = args;

			let url: string;
			if (typeof input === "string") {
				url = input;
			} else if (input instanceof Request) {
				url = input.url;
			} else if (input instanceof URL) {
				url = input.toString();
			} else {
				return self.originalFetch.apply(this, args);
			}

			if (shouldIgnoreUrl(url)) {
				return self.originalFetch.apply(this, args);
			}

			const method = init.method || "GET";
			const mock = self.mockManager.findMock(url, method);

			if (mock) {
				const response = await self.createMockResponse(mock);
				const responseBody = await response.clone().text();

				const request = self.createResponse({
					type: MESSAGE_TYPES.REQUEST_INTERCEPTED,
					url,
					method,
					mockId: mock.id,
					responseBody,
					statusCode: response.status,
					isMocked: true,
				});

				postMessageBatched(request);
				return response;
			}

			try {
				const response = await self.originalFetch.apply(this, args);

				if (self.shouldLogRequest(url)) {
					const clonedResponse = response.clone();
					const responseBody = await self.readResponseBody(clonedResponse);

					const request = self.createResponse({
						type: MESSAGE_TYPES.REQUEST_COMPLETED,
						url,
						method,
						responseBody,
						statusCode: response.status,
						isMocked: false,
					});

					postMessageBatched(request);
				}

				return response;
			} catch (error) {
				if (self.shouldLogRequest(url)) {
					const request = self.createResponse({
						type: MESSAGE_TYPES.REQUEST_ERROR,
						url,
						method,
						responseBody: "{}",
						statusCode: 0,
						isMocked: false,
						error: (error as Error).message || "Unknown error",
					});

					postMessageBatched(request);
				}
				throw error;
			}
		};
	}

	private interceptXHR(): void {
		const self = this;

		function MockedXMLHttpRequest() {
			const xhr = new self.originalXHR();
			const originalOpen = xhr.open.bind(xhr);
			const originalSend = xhr.send.bind(xhr);

			let requestUrl = "";
			let requestMethod = "GET";

			xhr.open = (
				method: string,
				url: string | URL,
				async?: boolean,
				user?: string | null,
				password?: string | null,
			) => {
				requestUrl = url.toString();
				requestMethod = method;
				if (async !== undefined) {
					return originalOpen(method, url, async, user, password);
				} else {
					return originalOpen(method, url);
				}
			};

			xhr.send = (body?: any) => {
				if (shouldIgnoreUrl(requestUrl)) {
					return originalSend(body);
				}

				const mock = self.mockManager.findMock(requestUrl, requestMethod);

				if (mock) {
					self.handleMockedXHR(xhr, mock, requestUrl, requestMethod);
					return;
				}

				if (self.shouldLogRequest(requestUrl)) {
					self.handleRealXHR(xhr, requestUrl, requestMethod);
				}
				return originalSend(body);
			};

			return xhr;
		}

		Object.setPrototypeOf(
			MockedXMLHttpRequest.prototype,
			this.originalXHR.prototype,
		);
		Object.setPrototypeOf(MockedXMLHttpRequest, this.originalXHR);

		const constants = [
			"UNSENT",
			"OPENED",
			"HEADERS_RECEIVED",
			"LOADING",
			"DONE",
		];
		for (const prop of constants) {
			Object.defineProperty(MockedXMLHttpRequest, prop, {
				value: (this.originalXHR as any)[prop],
				writable: false,
				enumerable: true,
				configurable: false,
			});
		}

		window.XMLHttpRequest = MockedXMLHttpRequest as any;
	}

	private handleMockedXHR(
		xhr: XMLHttpRequest,
		mock: TMock,
		url: string,
		method: string,
	): void {
		const executeResponse = () => {
			const responseBody =
				typeof mock.response === "string"
					? mock.response
					: JSON.stringify(mock.response);

			const status = mock.statusCode || 200;

			const request = this.createResponse({
				type: MESSAGE_TYPES.REQUEST_INTERCEPTED,
				url,
				method,
				mockId: mock.id,
				responseBody,
				statusCode: status,
				isMocked: true,
			});

			postMessageBatched(request);

			const properties = {
				readyState: 4,
				status,
				statusText: getStatusText(status),
				responseText: responseBody,
				response: responseBody,
			};

			for (const [key, value] of Object.entries(properties)) {
				Object.defineProperty(xhr, key, {
					value,
					writable: true,
					configurable: true,
				});
			}

			this.setXHRHeaders(xhr, mock.headers);

			xhr.onreadystatechange?.(new Event("readystatechange"));
			xhr.onload?.(new ProgressEvent("load"));
		};

		const delay = mock.delay || CONFIG.DEFAULT_DELAY;
		if (delay > 0) {
			setTimeout(executeResponse, delay);
		} else {
			requestAnimationFrame(executeResponse);
		}
	}

	private handleRealXHR(
		xhr: XMLHttpRequest,
		url: string,
		method: string,
	): void {
		const originalOnReadyStateChange = xhr.onreadystatechange;
		const self = this;

		xhr.onreadystatechange = function (this: XMLHttpRequest, ev: Event) {
			if (xhr.readyState === 4) {
				try {
					const responseBody = self.extractXHRResponseBody(xhr);

					const request = self.createResponse({
						type: MESSAGE_TYPES.REQUEST_COMPLETED,
						url,
						method,
						responseBody,
						statusCode: xhr.status,
						isMocked: false,
					});

					postMessageBatched(request);
				} catch {}
			}

			if (originalOnReadyStateChange) {
				originalOnReadyStateChange.call(this, ev);
			}
		};
	}

	private setXHRHeaders(
		xhr: XMLHttpRequest,
		headers?: Record<string, string>,
	): void {
		const headersList = ["content-type: application/json"];

		if (headers) {
			for (const [name, value] of Object.entries(headers)) {
				headersList.push(`${name.toLowerCase()}: ${value}`);
			}
		}

		xhr.getAllResponseHeaders = () => headersList.join("\r\n");
		xhr.getResponseHeader = (name: string) => {
			const lowerName = name.toLowerCase();
			if (headers) {
				for (const [headerName, headerValue] of Object.entries(headers)) {
					if (headerName.toLowerCase() === lowerName) {
						return headerValue;
					}
				}
			}
			return lowerName === "content-type" ? "application/json" : null;
		};
	}

	private extractXHRResponseBody(xhr: XMLHttpRequest): string {
		try {
			if (xhr.status === 204 || xhr.status === 304) {
				return "{}";
			}

			switch (xhr.responseType) {
				case "":
				case "text": {
					const responseText = xhr.responseText || "";
					return responseText.trim()
						? createSafeJsonResponse(responseText)
						: "{}";
				}

				case "json":
					if (xhr.response == null) return "{}";
					try {
						const jsonString = JSON.stringify(xhr.response);
						return jsonString.length > CONFIG.MAX_RESPONSE_LENGTH
							? `${jsonString.substring(0, CONFIG.MAX_RESPONSE_LENGTH)}...`
							: jsonString;
					} catch {
						return "{}";
					}

				case "document": {
					const docHtml = xhr.response?.documentElement?.outerHTML || "";
					return docHtml ? createSafeJsonResponse(docHtml, "document") : "{}";
				}

				case "arraybuffer":
					return xhr.response?.byteLength
						? `{"type":"arraybuffer","size":${xhr.response.byteLength},"data":"binary"}`
						: "{}";

				case "blob":
					return xhr.response
						? `{"type":"blob","size":${xhr.response.size},"mimeType":"${xhr.response.type || "unknown"}"}`
						: "{}";

				default:
					if (xhr.response == null) return "{}";
					return createSafeJsonResponse(String(xhr.response), "unknown");
			}
		} catch {
			return "{}";
		}
	}
}
