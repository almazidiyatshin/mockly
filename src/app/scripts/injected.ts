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

	const MAX_RESPONSE_LENGTH = 500; // Уменьшено для лучшей производительности
	const DEFAULT_DELAY = 0; // Убираем задержку по умолчанию

	// Кэш для compiled regex patterns
	const COMPILED_PATTERNS = new Map<string, RegExp>();

	// Функция для безопасного экранирования строк в JSON
	function escapeJsonString(str: string): string {
		const result = str
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"')
			.replace(/\n/g, "\\n")
			.replace(/\r/g, "\\r")
			.replace(/\t/g, "\\t")
			.replace(/\f/g, "\\f")
			.replace(/\b/g, "\\b");

		// Заменяем управляющие символы без использования regex с управляющими символами
		let escaped = "";
		for (let i = 0; i < result.length; i++) {
			const char = result[i];
			const code = char.charCodeAt(0);

			if ((code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)) {
				escaped += "\\u" + ("0000" + code.toString(16)).slice(-4);
			} else {
				escaped += char;
			}
		}

		return escaped;
	}

	// Функция для создания валидного JSON ответа
	function createSafeJsonResponse(
		content: string,
		type: string = "text",
	): string {
		try {
			// Сначала пытаемся распарсить как JSON
			JSON.parse(content);
			return content; // Если уже валидный JSON, возвращаем как есть
		} catch {
			// Если не JSON, оборачиваем в объект
			const truncated = content.substring(0, MAX_RESPONSE_LENGTH);
			const escaped = escapeJsonString(truncated);
			return JSON.stringify({ type, content: escaped });
		}
	}

	/**
	 * Быстрая проверка URL на игнорирование
	 */
	function shouldIgnoreUrl(url: string): boolean {
		// Быстрая проверка по началу URL
		if (
			url.startsWith("chrome-extension:") ||
			url.startsWith("moz-extension:") ||
			url.startsWith("about:") ||
			url.startsWith("data:") ||
			url.startsWith("blob:")
		) {
			return true;
		}

		// Проверяем аналитику и трекеры
		if (
			url.includes("google-analytics.com") ||
			url.includes("gtm.js") ||
			url.includes("clarity.ms") ||
			url.includes("facebook.com/tr") ||
			url.includes("doubleclick.net") ||
			url.includes("yandex.ru")
		) {
			return true;
		}

		// Проверка CDN только для статических ресурсов
		if (
			url.includes("cdnjs.cloudflare.com") ||
			url.includes("unpkg.com") ||
			url.includes("jsdelivr.net") ||
			url.includes("fonts.googleapis.com") ||
			url.includes("fonts.gstatic.com")
		) {
			// Проверяем расширение файла
			const lastDot = url.lastIndexOf(".");
			if (lastDot > 0) {
				const extension = url.substring(lastDot).toLowerCase();
				if (
					extension.match(
						/\.(css|js|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico)(\?|$)/,
					)
				) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Оптимизированный класс для управления моками
	 */
	class MockManager {
		private mocks: Mock[] = [];
		private mocksByMethod = new Map<string, Mock[]>();
		private exactUrlMocks = new Map<string, Mock>();

		updateMocks(mocks: Mock[]): void {
			this.mocks = mocks.filter((mock) => mock.enabled !== false);
			this.rebuildIndexes();
		}

		private rebuildIndexes(): void {
			this.mocksByMethod.clear();
			this.exactUrlMocks.clear();

			for (const mock of this.mocks) {
				const method = (mock.method || "GET").toLowerCase();

				if (!this.mocksByMethod.has(method)) {
					this.mocksByMethod.set(method, []);
				}
				this.mocksByMethod.get(method)!.push(mock);

				// Индексируем точные URL для быстрого поиска
				if (mock.url && !mock.urlPattern) {
					const key = `${method}:${this.normalizeUrl(mock.url)}`;
					this.exactUrlMocks.set(key, mock);
				}
			}
		}

		findMock(url: string, method: string = "GET"): Mock | null {
			if (this.mocks.length === 0) return null;

			const normalizedMethod = method.toLowerCase();
			const normalizedUrl = this.normalizeUrl(url);

			// Быстрый поиск по точному URL
			const exactKey = `${normalizedMethod}:${normalizedUrl}`;
			const exactMock = this.exactUrlMocks.get(exactKey);
			if (exactMock) return exactMock;

			// Поиск среди моков для данного метода
			const methodMocks = this.mocksByMethod.get(normalizedMethod) || [];
			const requestPath = this.getPathFromUrl(url);

			for (const mock of methodMocks) {
				if (this.isUrlMatch(mock, normalizedUrl, requestPath)) {
					return mock;
				}
			}

			return null;
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

		private isUrlMatch(
			mock: Mock,
			normalizedUrl: string,
			requestPath: string,
		): boolean {
			if (mock.url) {
				const normalizedMockUrl = this.normalizeUrl(mock.url);
				if (normalizedUrl === normalizedMockUrl) return true;

				const [urlBase] = normalizedUrl.split("?");
				const [mockBase] = normalizedMockUrl.split("?");
				if (urlBase === mockBase) return true;

				const mockPath = this.getPathFromUrl(mock.url);
				if (requestPath === mockPath) return true;

				const [pathBase] = requestPath.split("?");
				const [mockPathBase] = mockPath.split("?");
				if (pathBase === mockPathBase) return true;
			}

			if (mock.urlPattern) {
				let regex = COMPILED_PATTERNS.get(mock.urlPattern);
				if (!regex) {
					try {
						regex = new RegExp(mock.urlPattern);
						COMPILED_PATTERNS.set(mock.urlPattern, regex);
					} catch {
						console.warn("Invalid regex pattern:", mock.urlPattern);
						return false;
					}
				}
				return regex.test(normalizedUrl);
			}

			return false;
		}
	}

	/**
	 * Оптимизированный класс для перехвата HTTP запросов
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

		private setupMessageListener(): void {
			window.addEventListener("message", (event) => {
				if (event.source !== window) return;

				if (event.data.type === MESSAGE_TYPES.MOCKS_UPDATE) {
					const mocks = event.data.mocks || [];
					this.mockManager.updateMocks(mocks);
				}
			});
		}

		private getStatusText(status: number): string {
			return STATUS_TEXTS[status] || "Unknown";
		}

		private postMessage(data: InterceptedRequest): void {
			// Используем requestIdleCallback для оптимизации
			if ("requestIdleCallback" in window) {
				requestIdleCallback(() => window.postMessage(data, "*"));
			} else {
				setTimeout(() => window.postMessage(data, "*"), 0);
			}
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

			// Минимальная задержка только если указана
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
					return JSON.stringify({
						type: "binary",
						contentType: contentType,
						message: "Binary content not displayed",
					});
				}

				const text = await response.text();
				if (text.trim() === "") return "{}";

				// Используем безопасную функцию создания JSON
				return createSafeJsonResponse(
					text,
					contentType.includes("application/json") ? "json" : "text",
				);
			} catch (error) {
				return JSON.stringify({
					type: "error",
					message: `Error: ${(error as Error).message}`,
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
					return self.originalFetch.apply(this, args);
				}

				// Быстрая проверка на игнорирование
				if (shouldIgnoreUrl(url)) {
					return self.originalFetch.apply(this, args);
				}

				const method = init.method || "GET";
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

				// Обработка реальных запросов только если нужно логирование
				try {
					const response = await self.originalFetch.apply(this, args);

					// Логируем только API запросы, не статические ресурсы
					if (self.shouldLogRequest(url)) {
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
					}

					return response;
				} catch (error) {
					if (self.shouldLogRequest(url)) {
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
					}
					throw error;
				}
			};
		}

		private shouldLogRequest(url: string): boolean {
			// Не логируем игнорируемые URL
			if (shouldIgnoreUrl(url)) {
				return false;
			}

			// Логируем все запросы, кроме статических ресурсов
			const lastDot = url.lastIndexOf(".");
			if (lastDot > 0) {
				const extension = url.substring(lastDot).toLowerCase();
				// Игнорируем только явные статические файлы
				if (
					extension.match(
						/\.(css|js|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico)(\?|$)/,
					)
				) {
					return false;
				}
			}

			return true;
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

			window.XMLHttpRequest = MockedXMLHttpRequest as any;
		}

		private handleMockedXHR(
			xhr: XMLHttpRequest,
			mock: Mock,
			url: string,
			method: string,
		): void {
			const delay = mock.delay || DEFAULT_DELAY;

			const executeResponse = () => {
				let responseBody: string;

				try {
					responseBody =
						typeof mock.response === "string"
							? mock.response
							: JSON.stringify(mock.response);
				} catch (error) {
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

				this.setXHRHeaders(xhr, mock.headers);

				if (xhr.onreadystatechange) {
					xhr.onreadystatechange.call(xhr, new Event("readystatechange"));
				}
				if (xhr.onload) {
					xhr.onload.call(xhr, new ProgressEvent("load"));
				}
			};

			if (delay > 0) {
				setTimeout(executeResponse, delay);
			} else {
				// Используем requestAnimationFrame для лучшей производительности
				requestAnimationFrame(executeResponse);
			}
		}

		private handleRealXHR(
			xhr: XMLHttpRequest,
			url: string,
			method: string,
		): void {
			const self = this;
			const originalOnReadyStateChange = xhr.onreadystatechange;

			xhr.onreadystatechange = function (this: XMLHttpRequest, ev: Event) {
				if (xhr.readyState === 4) {
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
						// Тихо игнорируем ошибки для лучшей производительности
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
				if (xhr.status === 204 || xhr.status === 304) {
					return "{}";
				}

				switch (xhr.responseType) {
					case "":
					case "text": {
						const responseText = xhr.responseText || "";
						if (responseText.trim()) {
							return createSafeJsonResponse(responseText);
						}
						return "{}";
					}

					case "json":
						if (xhr.response === null || xhr.response === undefined) {
							return "{}";
						}
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
						if (docHtml) {
							return createSafeJsonResponse(docHtml, "document");
						}
						return "{}";
					}

					case "arraybuffer":
						if (!xhr.response || xhr.response.byteLength === 0) {
							return "{}";
						}
						return JSON.stringify({
							type: "arraybuffer",
							size: xhr.response.byteLength,
							data: "binary",
						});

					case "blob":
						if (!xhr.response) {
							return "{}";
						}
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
						return createSafeJsonResponse(responseString, "unknown");
					}
				}
			} catch {
				return "{}";
			}
		}
	}

	new RequestInterceptor();
})();
