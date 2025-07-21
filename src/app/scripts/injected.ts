(() => {
	const normalizeUrl = (inputUrl: string) => {
		if (inputUrl.startsWith("/")) {
			return window.location.origin + inputUrl;
		}
		return inputUrl;
	};

	const getPathFromUrl = (inputUrl: string) => {
		try {
			const urlObj = new URL(inputUrl, window.location.origin);
			return urlObj.pathname + urlObj.search;
		} catch {
			return inputUrl;
		}
	};

	const findMockForUrl = (url: string, method = "GET", mocks: any[]) => {
		if (mocks.length === 0) return null;

		const hasMocks = mocks.some((mock) => {
			if (mock.enabled === false) return false;
			const methodMatch =
				!mock.method || mock.method.toLowerCase() === method.toLowerCase();
			return methodMatch;
		});

		if (!hasMocks) {
			return null;
		}

		const mock = mocks.find((mock) => {
			const enabled = mock.enabled !== false;
			if (!enabled) return false;

			const methodMatch =
				!mock.method || mock.method.toLowerCase() === method.toLowerCase();
			if (!methodMatch) return false;

			const normalizedUrl = normalizeUrl(url);
			const normalizedMockUrl = normalizeUrl(mock.url);

			const exactMatch = normalizedUrl === normalizedMockUrl;
			const urlWithoutQuery = normalizedUrl.split("?")[0];
			const mockUrlWithoutQuery = normalizedMockUrl.split("?")[0];
			const baseUrlMatch = urlWithoutQuery === mockUrlWithoutQuery;

			const requestPath = getPathFromUrl(url);
			const mockPath = getPathFromUrl(mock.url);
			const pathMatch = requestPath === mockPath;
			const requestPathOnly = requestPath.split("?")[0];
			const mockPathOnly = mockPath.split("?")[0];
			const pathOnlyMatch = requestPathOnly === mockPathOnly;

			let regexMatch = false;

			if (mock.urlPattern) {
				try {
					const regex = new RegExp(mock.urlPattern);
					regexMatch = regex.test(normalizedUrl);
				} catch {
					console.warn("Invalid regex pattern:", mock.urlPattern);
				}
			}

			const urlMatch =
				exactMatch || baseUrlMatch || pathMatch || pathOnlyMatch || regexMatch;

			return urlMatch;
		});

		return mock;
	};

	const shouldInterceptRequest = (url: string) => {
		const ignorePatterns = [
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

		const shouldIgnore = ignorePatterns.some((pattern) => pattern.test(url));
		if (shouldIgnore) {
			return false;
		}

		return true;
	};

	const getStatusText = (status: number) => {
		const statusTexts: Record<number, string> = {
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
		return statusTexts[status] || "Unknown";
	};

	const cloneAndReadResponse = async (response: Response): Promise<string> => {
		const contentType = response.headers.get("content-type");
		const clonedResponse = response.clone();

		try {
			if (contentType && contentType.includes("application/json")) {
				const body = await clonedResponse.json();
				return JSON.stringify(body);
			} else {
				const body = await clonedResponse.text();
				return body;
			}
		} catch {
			return "";
		}
	};

	let mocks: any = [];
	const originalFetch = window.fetch;
	const originalXHR = window.XMLHttpRequest;

	window.addEventListener("message", (event) => {
		if (event.source !== window) return;

		if (event.data.type === "MOCKLY_MOCKS_UPDATE") {
			mocks = event.data.mocks;
		}
	});

	window.fetch = async function (...args: [RequestInfo | URL, RequestInit?]) {
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

		if (!shouldInterceptRequest(url)) {
			return originalFetch.apply(this, args);
		}

		const mock = findMockForUrl(url, method, mocks);

		if (mock) {
			const mockHeaders = new Headers();
			mockHeaders.set("Content-Type", "application/json");

			if (mock.headers) {
				Object.entries(mock.headers).forEach(([name, value]) => {
					//@ts-ignore
					mockHeaders.set(name, value);
				});
			}

			const responseBody =
				typeof mock.response === "string"
					? mock.response
					: JSON.stringify(mock.response);

			const mockResponse = new Response(responseBody, {
				status: mock.statusCode || 200,
				statusText: getStatusText(mock.statusCode || 200),
				headers: mockHeaders,
			});

			window.postMessage(
				{
					type: "MOCKLY_REQUEST_INTERCEPTED",
					url: url,
					method: method,
					mockId: mock.id,
					responseBody: responseBody,
					statusCode: mock.statusCode || 200,
					isMocked: true,
					timestamp: Date.now(),
				},
				"*",
			);

			const delay = mock.delay || 0;
			if (delay > 0) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}

			return Promise.resolve(mockResponse);
		}

		const response = await originalFetch.apply(this, args);

		const responseBody = await cloneAndReadResponse(response);

		window.postMessage(
			{
				type: "MOCKLY_REQUEST_COMPLETED",
				url: url,
				method: method,
				responseBody: responseBody,
				statusCode: response.status,
				isMocked: false,
				timestamp: Date.now(),
			},
			"*",
		);

		return response;
	};

	//@ts-ignore
	window.XMLHttpRequest = function XMLHttpRequest() {
		const xhr = new originalXHR();
		const originalOpen = xhr.open;
		const originalSend = xhr.send;

		let requestUrl = "";
		let requestMethod = "GET";

		//@ts-ignore
		xhr.open = function (method, url, ...args) {
			//@ts-ignore
			requestUrl = url;
			requestMethod = method;
			//@ts-ignore
			return originalOpen.apply(this, [method, url, ...args]);
		};

		xhr.send = function () {
			const mock = findMockForUrl(requestUrl, requestMethod, mocks);

			if (mock) {
				const delay = mock.delay || 10;

				setTimeout(() => {
					const responseBody =
						typeof mock.response === "string"
							? mock.response
							: JSON.stringify(mock.response);
					const status = mock.statusCode || 200;
					const statusText = getStatusText(status);

					window.postMessage(
						{
							type: "MOCKLY_REQUEST_INTERCEPTED",
							url: requestUrl,
							method: requestMethod,
							mockId: mock.id,
							responseBody: responseBody,
							statusCode: status,
							isMocked: true,
							timestamp: Date.now(),
						},
						"*",
					);

					Object.defineProperty(xhr, "readyState", {
						value: 4,
						writable: true,
					});
					Object.defineProperty(xhr, "status", {
						value: status,
						writable: true,
					});
					Object.defineProperty(xhr, "statusText", {
						value: statusText,
						writable: true,
					});
					Object.defineProperty(xhr, "responseText", {
						value: responseBody,
						writable: true,
					});
					Object.defineProperty(xhr, "response", {
						value: responseBody,
						writable: true,
					});

					xhr.getAllResponseHeaders = () => {
						const headers = ["content-type: application/json"];
						if (mock.headers) {
							Object.entries(mock.headers).forEach(([name, value]) => {
								headers.push(`${name.toLowerCase()}: ${value}`);
							});
						}
						return headers.join("\r\n");
					};
					//@ts-ignore
					xhr.getResponseHeader = (name) => {
						const lowerName = name.toLowerCase();
						if (mock.headers) {
							for (const [headerName, headerValue] of Object.entries(
								mock.headers,
							)) {
								if (headerName.toLowerCase() === lowerName) {
									return headerValue;
								}
							}
						}
						if (lowerName === "content-type") {
							return "application/json";
						}
						return null;
					};

					if (xhr.onreadystatechange) {
						//@ts-ignore
						xhr.onreadystatechange();
					}

					if (xhr.onload) {
						//@ts-ignore
						xhr.onload();
					}
				}, delay);

				return;
			}

			const originalOnReadyStateChange = xhr.onreadystatechange;

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					let responseBody = "";
					try {
						if (xhr.responseType === "" || xhr.responseType === "text") {
							responseBody = xhr.responseText;
						} else if (xhr.responseType === "json") {
							responseBody = JSON.stringify(xhr.response);
						} else if (xhr.responseType === "document") {
							responseBody = xhr.response?.documentElement?.outerHTML || "";
						} else if (xhr.responseType === "arraybuffer") {
							try {
								const decoder = new TextDecoder();
								responseBody = decoder.decode(xhr.response);
							} catch {
								responseBody = "[Binary data]";
							}
						} else if (xhr.responseType === "blob") {
							responseBody = "[Blob data]";
						} else {
							responseBody = String(xhr.response);
						}
					} catch (e) {
						responseBody = "";
					}

					// Отправляем сообщение с телом ответа
					window.postMessage(
						{
							type: "MOCKLY_REQUEST_COMPLETED",
							url: requestUrl,
							method: requestMethod,
							responseBody: responseBody,
							statusCode: xhr.status,
							isMocked: false,
							timestamp: Date.now(),
						},
						"*",
					);
				}

				if (originalOnReadyStateChange) {
					//@ts-ignore
					originalOnReadyStateChange.apply(this, arguments);
				}
			};

			//@ts-ignore
			return originalSend.apply(this, arguments);
		};

		return xhr;
	};

	Object.setPrototypeOf(window.XMLHttpRequest, originalXHR);

	["UNSENT", "OPENED", "HEADERS_RECEIVED", "LOADING", "DONE"].forEach(
		(prop) => {
			Object.defineProperty(window.XMLHttpRequest, prop, {
				//@ts-ignore
				value: originalXHR[prop],
				writable: false,
				enumerable: true,
				configurable: false,
			});
		},
	);
})();
