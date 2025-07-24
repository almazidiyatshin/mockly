(() => {
	// Типы
	interface Mock {
		id: string;
		url?: string;
		urlPattern?: string;
		method?: string;
		response: any;
		statusCode?: number;
		headers?: Record<string, string>;
		delay?: number;
		enabled?: boolean;
	}

	interface InterceptedRequest {
		type: string;
		url: string;
		method: string;
		mockId?: string;
		responseBody: string;
		statusCode: number;
		isMocked: boolean;
		timestamp: number;
		error?: string;
	}

	// Константы
	const MESSAGE_TYPES = {
		MOCKS_UPDATE: "MOCKLY_MOCKS_UPDATE",
		REQUEST_INTERCEPTED: "MOCKLY_REQUEST_INTERCEPTED",
		REQUEST_COMPLETED: "MOCKLY_REQUEST_COMPLETED",
		REQUEST_ERROR: "MOCKLY_REQUEST_ERROR",
	} as const;

	const IGNORE_PATTERNS = [
		/chrome-extension:/,
		/moz-extension:/,
		/about:/,
		/javascript:/,
		/data:/,
		/blob:/,
		/metrics\.yandex\.ru/,
		/mc\.yandex\.ru/,
		/google-analytics\.com/,
		/gtm\.js/,
		/clarity\.ms/,
		/facebook\.com\/tr/,
		/doubleclick\.net/,
	];

	const STATUS_TEXTS: Record<number, string> = {
		200: "OK",
		201: "Created",
		204: "No Content",
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not Found",
		500: "Internal Server Error",
		502: "Bad Gateway",
		503: "Service Unavailable",
	};

	const BINARY_CONTENT_TYPES = [
		"application/octet-stream",
		"image/",
		"video/",
		"audio/",
		"application/pdf",
		"application/zip",
	];

	const MAX_RESPONSE_LENGTH = 1000;
	const DEFAULT_DELAY = 10;

	/**
	 * Класс для управления моками
	 */
	class MockManager {
		private mocks: Mock[] = [];

		/**
		 * Обновляет список моков
		 */
		updateMocks(mocks: Mock[]): void {
			this.mocks = mocks.filter((mock) => mock.enabled !== false);
		}

		/**
		 * Находит подходящий мок для URL и метода
		 */
		findMock(url: string, method: string = "GET"): Mock | null {
			if (this.mocks.length === 0) return null;

			const normalizedUrl = this.normalizeUrl(url);
			const requestPath = this.getPathFromUrl(url);

			return (
				this.mocks.find((mock) => {
					if (!this.isMethodMatch(mock, method)) return false;

					return this.isUrlMatch(mock, normalizedUrl, requestPath);
				}) || null
			);
		}

		private normalizeUrl(inputUrl: string): string {
			if (inputUrl.startsWith("/")) {
				return window.location.origin + inputUrl;
			}
			return inputUrl;
		}

		private getPathFromUrl(inputUrl: string): string {
			try {
				const urlObj = new URL(inputUrl, window.location.origin);
				return urlObj.pathname + urlObj.search;
			} catch {
				return inputUrl;
			}
		}

		private isMethodMatch(mock: Mock, method: string): boolean {
			return !mock.method || mock.method.toLowerCase() === method.toLowerCase();
		}

		private isUrlMatch(
			mock: Mock,
			normalizedUrl: string,
			requestPath: string,
		): boolean {
			// Exact URL match
			if (mock.url) {
				const normalizedMockUrl = this.normalizeUrl(mock.url);

				if (normalizedUrl === normalizedMockUrl) return true;

				// Base URL match (without query)
				const [urlBase] = normalizedUrl.split("?");
				const [mockBase] = normalizedMockUrl.split("?");
				if (urlBase === mockBase) return true;

				// Path match
				const mockPath = this.getPathFromUrl(mock.url);
				if (requestPath === mockPath) return true;

				// Path only match (without query)
				const [pathBase] = requestPath.split("?");
				const [mockPathBase] = mockPath.split("?");
				if (pathBase === mockPathBase) return true;
			}

			// Regex pattern match
			if (mock.urlPattern) {
				try {
					const regex = new RegExp(mock.urlPattern);
					return regex.test(normalizedUrl);
				} catch {
					console.warn("Invalid regex pattern:", mock.urlPattern);
				}
			}

			return false;
		}
	}

	/**
	 * Класс для перехвата HTTP запросов
	 */
	class RequestInterceptor {
		private mockManager = new MockManager();
		private originalFetch = window.fetch;
		private originalXHR = window.XMLHttpRequest;

		constructor() {
			this.setupMessageListener();
			this.interceptFetch();
			this.interceptXHR();
		}

		/**
		 * Настраивает слушатель сообщений для обновления моков
		 */
		private setupMessageListener(): void {
			window.addEventListener("message", (event) => {
				if (event.source !== window) return;

				if (event.data.type === MESSAGE_TYPES.MOCKS_UPDATE) {
					this.mockManager.updateMocks(event.data.mocks);
				}
			});
		}

		private shouldInterceptRequest(url: string): boolean {
			return !IGNORE_PATTERNS.some((pattern) => pattern.test(url));
		}

		private getStatusText(status: number): string {
			return STATUS_TEXTS[status] || "Unknown";
		}

		private postMessage(data: InterceptedRequest): void {
			window.postMessage(data, "*");
		}

		private async createMockResponse(mock: Mock): Promise<Response> {
			const headers = new Headers({ "Content-Type": "application/json" });

			if (mock.headers) {
				Object.entries(mock.headers).forEach(([name, value]) => {
					headers.set(name, value);
				});
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
				statusText: this.getStatusText(status),
				headers,
			});
		}

		private async readResponseBody(response: Response): Promise<string> {
			const contentType = response.headers.get("content-type") || "";

			try {
				if (
					!response.body ||
					response.status === 204 ||
					response.status === 304
				) {
					return "{}";
				}

				if (BINARY_CONTENT_TYPES.some((type) => contentType.includes(type))) {
					// Возвращаем валидный JSON для бинарных данных
					return JSON.stringify({
						type: "binary",
						contentType: contentType,
						message: "Binary content not displayed",
					});
				}

				const text = await response.text();

				if (text.trim() === "") {
					return "{}";
				}

				// Проверяем, является ли ответ валидным JSON
				if (contentType.includes("application/json")) {
					try {
						const parsed = JSON.parse(text);
						const stringified = JSON.stringify(parsed);
						return stringified.length > MAX_RESPONSE_LENGTH
							? stringified.substring(0, MAX_RESPONSE_LENGTH) + "..."
							: stringified;
					} catch {
						// Если JSON невалидный, оборачиваем текст в JSON объект
						const escaped = text
							.replace(/\\/g, "\\\\")
							.replace(/"/g, '\\"')
							.replace(/\n/g, "\\n")
							.replace(/\r/g, "\\r");
						return JSON.stringify({
							type: "invalid_json",
							content: escaped.substring(0, MAX_RESPONSE_LENGTH),
						});
					}
				}

				// Для не-JSON ответов оборачиваем в JSON объект
				const escaped = text
					.replace(/\\/g, "\\\\")
					.replace(/"/g, '\\"')
					.replace(/\n/g, "\\n")
					.replace(/\r/g, "\\r");
				return JSON.stringify({
					type: "text",
					content: escaped.substring(0, MAX_RESPONSE_LENGTH),
				});
			} catch (error) {
				console.warn("Error reading response body:", error);
				return JSON.stringify({
					type: "error",
					message: `Error reading response: ${(error as Error).message}`,
				});
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
					throw new Error("Unsupported fetch input");
				}

				const method = init.method || "GET";

				if (!self.shouldInterceptRequest(url)) {
					return self.originalFetch.apply(this, args);
				}

				const mock = self.mockManager.findMock(url, method);

				if (mock) {
					const response = await self.createMockResponse(mock);
					const responseBody = await response.clone().text();

					self.postMessage({
						type: MESSAGE_TYPES.REQUEST_INTERCEPTED,
						url,
						method,
						mockId: mock.id,
						responseBody,
						statusCode: response.status,
						isMocked: true,
						timestamp: Date.now(),
					});

					return response;
				}

				// Handle real requests
				try {
					const response = await self.originalFetch.apply(this, args);
					const clonedResponse = response.clone();

					const responseBody = await self.readResponseBody(clonedResponse);

					self.postMessage({
						type: MESSAGE_TYPES.REQUEST_COMPLETED,
						url,
						method,
						responseBody,
						statusCode: response.status,
						isMocked: false,
						timestamp: Date.now(),
					});

					return response;
				} catch (error) {
					console.error("Fetch interceptor error:", error);

					self.postMessage({
						type: MESSAGE_TYPES.REQUEST_ERROR,
						url,
						method,
						responseBody: "{}",
						statusCode: 0,
						isMocked: false,
						error: (error as Error).message || "Unknown error",
						timestamp: Date.now(),
					});

					throw error;
				}
			};
		}

		private interceptXHR(): void {
			const self = this;

			// Создаем новый конструктор XMLHttpRequest
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
					if (!self.shouldInterceptRequest(requestUrl)) {
						return originalSend(body);
					}

					const mock = self.mockManager.findMock(requestUrl, requestMethod);

					if (mock) {
						self.handleMockedXHR(xhr, mock, requestUrl, requestMethod);
						return;
					}

					self.handleRealXHR(xhr, requestUrl, requestMethod);
					return originalSend(body);
				};

				// Возвращаем модифицированный xhr объект
				return xhr;
			}

			// Копируем статические свойства и методы
			Object.setPrototypeOf(
				MockedXMLHttpRequest.prototype,
				this.originalXHR.prototype,
			);
			Object.setPrototypeOf(MockedXMLHttpRequest, this.originalXHR);

			// Копируем константы
			["UNSENT", "OPENED", "HEADERS_RECEIVED", "LOADING", "DONE"].forEach(
				(prop) => {
					Object.defineProperty(MockedXMLHttpRequest, prop, {
						value: (this.originalXHR as any)[prop],
						writable: false,
						enumerable: true,
						configurable: false,
					});
				},
			);

			// Заменяем глобальный XMLHttpRequest
			window.XMLHttpRequest = MockedXMLHttpRequest as any;
		}

		private handleMockedXHR(
			xhr: XMLHttpRequest,
			mock: Mock,
			url: string,
			method: string,
		): void {
			const delay = mock.delay || DEFAULT_DELAY;

			setTimeout(() => {
				let responseBody: string;

				try {
					if (typeof mock.response === "string") {
						responseBody = mock.response;
					} else {
						responseBody = JSON.stringify(mock.response);
					}
				} catch (error) {
					console.warn("Error serializing mock response:", error);
					responseBody = "{}";
				}

				const status = mock.statusCode || 200;

				this.postMessage({
					type: MESSAGE_TYPES.REQUEST_INTERCEPTED,
					url,
					method,
					mockId: mock.id,
					responseBody,
					statusCode: status,
					isMocked: true,
					timestamp: Date.now(),
				});

				// Устанавливаем свойства XHR
				Object.defineProperty(xhr, "readyState", {
					value: 4,
					writable: true,
					configurable: true,
				});
				Object.defineProperty(xhr, "status", {
					value: status,
					writable: true,
					configurable: true,
				});
				Object.defineProperty(xhr, "statusText", {
					value: this.getStatusText(status),
					writable: true,
					configurable: true,
				});
				Object.defineProperty(xhr, "responseText", {
					value: responseBody,
					writable: true,
					configurable: true,
				});
				Object.defineProperty(xhr, "response", {
					value: responseBody,
					writable: true,
					configurable: true,
				});

				// Устанавливаем заголовки ответа
				this.setXHRHeaders(xhr, mock.headers);

				// Вызываем события
				if (xhr.onreadystatechange) {
					xhr.onreadystatechange.call(xhr, new Event("readystatechange"));
				}
				if (xhr.onload) {
					xhr.onload.call(xhr, new ProgressEvent("load"));
				}
			}, delay);
		}

		private handleRealXHR(
			xhr: XMLHttpRequest,
			url: string,
			method: string,
		): void {
			const self = this;
			const originalOnReadyStateChange = xhr.onreadystatechange;

			xhr.onreadystatechange = function (this: XMLHttpRequest, ev: Event) {
				if (xhr.readyState === 4 && self.shouldInterceptRequest(url)) {
					try {
						const responseBody = self.extractXHRResponseBody(xhr);

						self.postMessage({
							type: MESSAGE_TYPES.REQUEST_COMPLETED,
							url,
							method,
							responseBody,
							statusCode: xhr.status,
							isMocked: false,
							timestamp: Date.now(),
						});
					} catch (error) {
						console.warn("Error handling real XHR response:", error);
					}
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
				Object.entries(headers).forEach(([name, value]) => {
					headersList.push(`${name.toLowerCase()}: ${value}`);
				});
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
				// Если статус указывает на ошибку или пустой ответ, возвращаем пустой JSON
				if (xhr.status === 204 || xhr.status === 304) {
					return "{}";
				}

				switch (xhr.responseType) {
					case "":
					case "text": {
						const responseText = xhr.responseText || "";

						// Пытаемся распарсить как JSON, чтобы убедиться что это валидный JSON
						if (responseText.trim()) {
							try {
								JSON.parse(responseText);
								if (responseText.length > MAX_RESPONSE_LENGTH) {
									const parsed = JSON.parse(responseText);
									return (
										JSON.stringify(parsed).substring(0, MAX_RESPONSE_LENGTH) +
										"..."
									);
								}
								return responseText;
							} catch {
								// Если это не JSON, оборачиваем в JSON объект
								const escaped = responseText
									.replace(/\\/g, "\\\\")
									.replace(/"/g, '\\"')
									.replace(/\n/g, "\\n")
									.replace(/\r/g, "\\r");
								const wrappedResponse = JSON.stringify({
									text: escaped.substring(0, MAX_RESPONSE_LENGTH),
								});
								return wrappedResponse;
							}
						}
						return "{}";
					}

					case "json":
						// Для JSON responseType, xhr.response уже распарсен браузером
						if (xhr.response === null || xhr.response === undefined) {
							return "{}";
						}
						try {
							const jsonString = JSON.stringify(xhr.response);
							if (jsonString.length > MAX_RESPONSE_LENGTH) {
								return jsonString.substring(0, MAX_RESPONSE_LENGTH) + "...";
							}
							return jsonString;
						} catch (jsonError) {
							console.warn("Error stringifying JSON response:", jsonError);
							return "{}";
						}

					case "document": {
						const docHtml = xhr.response?.documentElement?.outerHTML || "";
						const escapedHtml = docHtml
							.replace(/\\/g, "\\\\")
							.replace(/"/g, '\\"')
							.replace(/\n/g, "\\n")
							.replace(/\r/g, "\\r");
						return JSON.stringify({
							type: "document",
							content: escapedHtml.substring(0, MAX_RESPONSE_LENGTH),
						});
					}

					case "arraybuffer":
						if (!xhr.response || xhr.response.byteLength === 0) {
							return "{}";
						}
						// Возвращаем валидный JSON объект с информацией о буфере
						return JSON.stringify({
							type: "arraybuffer",
							size: xhr.response.byteLength,
							data: "binary",
						});

					case "blob":
						if (!xhr.response) {
							return "{}";
						}
						// Возвращаем валидный JSON объект с информацией о blob
						return JSON.stringify({
							type: "blob",
							size: xhr.response.size,
							mimeType: xhr.response.type || "unknown",
						});

					default: {
						if (xhr.response === null || xhr.response === undefined) {
							return "{}";
						}

						const responseString = String(xhr.response);
						// Пытаемся распарсить как JSON
						try {
							JSON.parse(responseString);
							if (responseString.length > MAX_RESPONSE_LENGTH) {
								return responseString.substring(0, MAX_RESPONSE_LENGTH) + "...";
							}
							return responseString;
						} catch {
							// Если не JSON, оборачиваем в JSON объект
							const escaped = responseString
								.replace(/\\/g, "\\\\")
								.replace(/"/g, '\\"')
								.replace(/\n/g, "\\n")
								.replace(/\r/g, "\\r");
							return JSON.stringify({
								type: "unknown",
								content: escaped.substring(0, MAX_RESPONSE_LENGTH),
							});
						}
					}
				}
			} catch (error) {
				console.warn("Error extracting XHR response body:", error);
				return "{}";
			}
		}
	}

	new RequestInterceptor();
})();
