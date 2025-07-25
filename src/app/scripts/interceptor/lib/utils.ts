import {
	ANALYTICS_REGEX,
	CDN_REGEX,
	CONFIG,
	JSON_ESCAPE_MAP,
	STATIC_FILE_REGEX,
	STATUS_TEXTS,
} from "../constants";

const urlCache = new Map<string, boolean>();

export const escapeJsonString = (str: string) => {
	let result = "";
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		const code = char.charCodeAt(0);

		if (JSON_ESCAPE_MAP[char]) {
			result += JSON_ESCAPE_MAP[char];
		} else if (code < 32 || code > 126) {
			result += "\\u" + ("0000" + code.toString(16)).slice(-4);
		} else {
			result += char;
		}
	}
	return result;
};

export const createSafeJsonResponse = (
	content: string,
	type: string = "text",
) => {
	const trimmed = content.trim();
	if (trimmed && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
		try {
			const parsed = JSON.parse(trimmed);
			const serialized = JSON.stringify(parsed);
			return serialized.length > CONFIG.MAX_RESPONSE_LENGTH
				? JSON.stringify({
						type: "json",
						content: "Response too large",
						size: serialized.length,
					})
				: serialized;
		} catch {}
	}

	let truncated = content;
	if (content.length > CONFIG.MAX_RESPONSE_LENGTH) {
		truncated = `${content.substring(0, CONFIG.MAX_RESPONSE_LENGTH - 50)}...`;
	}

	return JSON.stringify({
		type: type,
		content: truncated,
	});
};

export const shouldIgnoreUrl = (url: string) => {
	const cached = urlCache.get(url);
	if (cached !== undefined) return cached;

	let shouldIgnore = false;

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

	if (urlCache.size < CONFIG.CACHE_LIMITS.URL_CACHE) {
		urlCache.set(url, shouldIgnore);
	}

	return shouldIgnore;
};

export const getStatusText = (status: number) => {
	return STATUS_TEXTS[status] || "Unknown";
};

export const cleanupUrlCache = () => {
	if (urlCache.size > CONFIG.CACHE_LIMITS.URL_CACHE / 2) {
		urlCache.clear();
	}
};
