const hasPotentialMocks = (method = "GET", mocks: any[]) => {
	if (mocks.length === 0) return false;

	return mocks.some((mock) => {
		if (mock.enabled === false) return false;
		const methodMatch =
			!mock.method || mock.method.toLowerCase() === method.toLowerCase();
		return methodMatch;
	});
};

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
	} catch (e) {
		return inputUrl;
	}
};

export const findMockForUrl = (url: string, method = "GET", mocks: any[]) => {
	if (!hasPotentialMocks(method, mocks)) {
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
			} catch (e) {
				console.warn("Invalid regex pattern:", mock.urlPattern);
			}
		}

		const urlMatch =
			exactMatch || baseUrlMatch || pathMatch || pathOnlyMatch || regexMatch;

		return urlMatch;
	});

	return mock;
};

export const shouldInterceptRequest = (url: string) => {
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

export const getStatusText = (status: number) => {
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
