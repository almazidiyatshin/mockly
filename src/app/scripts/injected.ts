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

	const MAX_RESPONSE_LENGTH = 500;
	const DEFAULT_DELAY = 0;
	const MESSAGE_BATCH_SIZE = 10;
	const MESSAGE_BATCH_DELAY = 16; // ~60fps

	// Предкомпилированные regex для лучшей производительности
	const STATIC_FILE_REGEX =
		/\.(css|js|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico)(\?|$)/i;
	const CDN_REGEX =
		/^https?:\/\/(cdnjs\.cloudflare\.com|unpkg\.com|jsdelivr\.net|fonts\.g(oogle)?apis\.com|fonts\.gstatic\.com)/;
	const ANALYTICS_REGEX =
		/(google-analytics|gtm\.js|clarity\.ms|facebook\.com\/tr|doubleclick\.net|yandex\.ru)/;

	// Кэши для оптимизации
	const COMPILED_PATTERNS = new Map<string, RegExp>();
	const URL_CACHE = new Map<string, boolean>(); // Кэш для shouldIgnoreUrl
	const MOCK_CACHE = new Map<string, Mock | null>(); // Кэш для findMock

	// Батчинг сообщений для уменьшения overhead
	let messageBatch: InterceptedRequest[] = [];
	let batchTimeout: number | null = null;

	// Пул объектов для переиспользования
	const requestPool: InterceptedRequest[] = [];

	function createRequest(): InterceptedRequest {
		return (
			requestPool.pop() || {
				type: "",
				url: "",
				method: "",
				responseBody: "",
				statusCode: 0,
				isMocked: false,
				timestamp: 0,
			}
		);
	}

	function recycleRequest(request: InterceptedRequest): void {
		if (requestPool.length < 50) {
			// Ограничиваем размер пула
			requestPool.push(request);
		}
	}

	// Оптимизированная функция для экранирования JSON
	const JSON_ESCAPE_MAP: Record<string, string> = {
		'"': '\\"',
		"\\": "\\\\",
		"\b": "\\b",
		"\f": "\\f",
		"\n": "\\n",
		"\r": "\\r",
		"\t": "\\t",
	};

	function escapeJsonString(str: string): string {
		// Быстрая проверка - нужно ли экранирование
		if (!/["\\/\b\f\n\r\t]/.test(str)) {
			return str;
		}

		return str.replace(
			/["\\/\b\f\n\r\t]/g,
			(match) => JSON_ESCAPE_MAP[match] || match,
		);
	}

	function createSafeJsonResponse(
		content: string,
		type: string = "text",
	): string {
		// Быстрая проверка на JSON
		if (
			type === "json" ||
			content.trim().startsWith("{") ||
			content.trim().startsWith("[")
		) {
			try {
				JSON.parse(content);
				return content.length > MAX_RESPONSE_LENGTH
					? content.substring(0, MAX_RESPONSE_LENGTH) + "..."
					: content;
			} catch {
				// Fallback
			}
		}

		const truncated = content.substring(0, MAX_RESPONSE_LENGTH);
		const escaped = escapeJsonString(truncated);
		return `{"type":"${type}","content":"${escaped}"}`;
	}

	// Оптимизированная проверка URL с кэшированием
	function shouldIgnoreUrl(url: string): boolean {
		// Проверяем кэш
		const cached = URL_CACHE.get(url);
		if (cached !== undefined) return cached;

		let shouldIgnore = false;

		// Быстрые проверки первыми
		if (url.length < 10) {
			shouldIgnore = true;
		} else if (
			url.startsWith("chrome-extension:") ||
			url.startsWith("moz-extension:") ||
			url.startsWith("about:") ||
			url.startsWith("data:") ||
			url.startsWith("blob:")
		) {
			shouldIgnore = true;
		} else if (ANALYTICS_REGEX.test(url)) {
			shouldIgnore = true;
		} else if (CDN_REGEX.test(url) && STATIC_FILE_REGEX.test(url)) {
			shouldIgnore = true;
		} else if (STATIC_FILE_REGEX.test(url)) {
			shouldIgnore = true;
		}

		// Кэшируем результат (ограничиваем размер кэша)
		if (URL_CACHE.size < 1000) {
			URL_CACHE.set(url, shouldIgnore);
		}

		return shouldIgnore;
	}

	// Батчинг сообщений для уменьшения нагрузки на main thread
	function postMessageBatched(data: InterceptedRequest): void {
		messageBatch.push(data);

		if (messageBatch.length >= MESSAGE_BATCH_SIZE) {
			flushMessageBatch();
		} else if (batchTimeout === null) {
			batchTimeout = window.setTimeout(flushMessageBatch, MESSAGE_BATCH_DELAY);
		}
	}

	function flushMessageBatch(): void {
		if (batchTimeout !== null) {
			clearTimeout(batchTimeout);
			batchTimeout = null;
		}

		if (messageBatch.length === 0) return;

		// Отправляем батч
		if ("requestIdleCallback" in window) {
			requestIdleCallback(() => {
				messageBatch.forEach((msg) => {
					window.postMessage(msg, "*");
					recycleRequest(msg);
				});
				messageBatch = [];
			});
		} else {
			setTimeout(() => {
				messageBatch.forEach((msg) => {
					window.postMessage(msg, "*");
					recycleRequest(msg);
				});
				messageBatch = [];
			}, 0);
		}
	}

	/**
	 * Ультра-оптимизированный MockManager
	 */
	class MockManager {
		private mocks: Mock[] = [];
		private exactUrlMap = new Map<string, Mock>();
		private patternMocks: Mock[] = [];

		updateMocks(mocks: Mock[]): void {
			this.mocks = mocks.filter((mock) => mock.enabled !== false);
			this.rebuildIndexes();
			MOCK_CACHE.clear(); // Очищаем кэш при обновлении моков
		}

		private rebuildIndexes(): void {
			this.exactUrlMap.clear();
			this.patternMocks = [];

			for (const mock of this.mocks) {
				if (mock.urlPattern) {
					this.patternMocks.push(mock);
				} else if (mock.url) {
					const method = (mock.method || "GET").toLowerCase();
					const normalizedUrl = this.normalizeUrl(mock.url);
					const key = `${method}:${normalizedUrl}`;
					this.exactUrlMap.set(key, mock);
				}
			}
		}

		findMock(url: string, method: string = "GET"): Mock | null {
			if (this.mocks.length === 0) return null;

			// Проверяем кэш
			const cacheKey = `${method.toLowerCase()}:${url}`;
			const cached = MOCK_CACHE.get(cacheKey);
			if (cached !== undefined) return cached;

			const normalizedMethod = method.toLowerCase();
			const normalizedUrl = this.normalizeUrl(url);

			// Точный поиск по URL
			const exactKey = `${normalizedMethod}:${normalizedUrl}`;
			const exactMock = this.exactUrlMap.get(exactKey);
			if (exactMock) {
				this.cacheMock(cacheKey, exactMock);
				return exactMock;
			}

			// Поиск по паттернам
			for (const mock of this.patternMocks) {
				if (mock.method && mock.method.toLowerCase() !== normalizedMethod)
					continue;
				if (!mock.urlPattern) continue;

				let regex = COMPILED_PATTERNS.get(mock.urlPattern);
				if (!regex) {
					try {
						regex = new RegExp(mock.urlPattern);
						if (COMPILED_PATTERNS.size < 100) {
							COMPILED_PATTERNS.set(mock.urlPattern, regex);
						}
					} catch {
						continue;
					}
				}

				if (regex.test(normalizedUrl)) {
					this.cacheMock(cacheKey, mock);
					return mock;
				}
			}

			this.cacheMock(cacheKey, null);
			return null;
		}

		private cacheMock(key: string, mock: Mock | null): void {
			if (MOCK_CACHE.size < 500) {
				// Ограничиваем размер кэша
				MOCK_CACHE.set(key, mock);
			}
		}

		private normalizeUrl(inputUrl: string): string {
			return inputUrl.startsWith("/")
				? window.location.origin + inputUrl
				: inputUrl;
		}
	}

	/**
	 * Максимально оптимизированный RequestInterceptor
	 */
	class RequestInterceptor {
		private mockManager = new MockManager();
		private originalFetch = window.fetch;
		private originalXHR = window.XMLHttpRequest;

		constructor() {
			this.setupMessageListener();
			this.interceptFetch();
			this.interceptXHR();

			// Периодическая очистка кэшей для предотвращения утечек памяти
			setInterval(() => this.cleanupCaches(), 300000); // каждые 5 минут
		}

		private cleanupCaches(): void {
			if (URL_CACHE.size > 500) {
				URL_CACHE.clear();
			}
			if (MOCK_CACHE.size > 300) {
				MOCK_CACHE.clear();
			}
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

		private getStatusText(status: number): string {
			return STATUS_TEXTS[status] || "Unknown";
		}

		private createResponse(
			data: Partial<InterceptedRequest>,
		): InterceptedRequest {
			const request = createRequest();
			Object.assign(request, data);
			request.timestamp = Date.now();
			return request;
		}

		private async createMockResponse(mock: Mock): Promise<Response> {
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
				statusText: this.getStatusText(status),
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

			// Копируем прототип и статические свойства
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
			mock: Mock,
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

				// Устанавливаем свойства XHR
				const properties = {
					readyState: 4,
					status,
					statusText: this.getStatusText(status),
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

				// Вызываем события
				xhr.onreadystatechange?.(new Event("readystatechange"));
				xhr.onload?.(new ProgressEvent("load"));
			};

			const delay = mock.delay || DEFAULT_DELAY;
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
					} catch {
						// Игнорируем ошибки для производительности
					}
				}

				if (originalOnReadyStateChange) {
					originalOnReadyStateChange.call(this, ev);
				}
			};

			const self = this;
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
							return jsonString.length > MAX_RESPONSE_LENGTH
								? jsonString.substring(0, MAX_RESPONSE_LENGTH) + "..."
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
							? `{"type":"blob","size":${xhr.response.size},"mimeType":"${
									xhr.response.type || "unknown"
								}"}`
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

	new RequestInterceptor();
})();
