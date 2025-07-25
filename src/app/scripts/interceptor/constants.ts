export const MESSAGE_TYPES = {
	MOCKS_UPDATE: "MOCKLY_MOCKS_UPDATE",
	REQUEST_INTERCEPTED: "MOCKLY_REQUEST_INTERCEPTED",
	REQUEST_COMPLETED: "MOCKLY_REQUEST_COMPLETED",
	REQUEST_ERROR: "MOCKLY_REQUEST_ERROR",
} as const;

export const STATUS_TEXTS: Record<number, string> = {
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

export const BINARY_CONTENT_TYPES = [
	"application/octet-stream",
	"image/",
	"video/",
	"audio/",
	"application/pdf",
	"application/zip",
];

export const CONFIG = {
	MAX_RESPONSE_LENGTH: 500,
	DEFAULT_DELAY: 0,
	MESSAGE_BATCH_SIZE: 10,
	MESSAGE_BATCH_DELAY: 16,
	CACHE_LIMITS: {
		URL_CACHE: 1000,
		MOCK_CACHE: 500,
		PATTERN_CACHE: 100,
		OBJECT_POOL: 50,
	},
} as const;

export const STATIC_FILE_REGEX =
	/\.(css|js|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico)(\?|$)/i;
export const CDN_REGEX =
	/^https?:\/\/(cdnjs\.cloudflare\.com|unpkg\.com|jsdelivr\.net|fonts\.g(oogle)?apis\.com|fonts\.gstatic\.com)/;
export const ANALYTICS_REGEX =
	/(google-analytics|gtm\.js|clarity\.ms|facebook\.com\/tr|doubleclick\.net|yandex\.ru)/;

export const JSON_ESCAPE_MAP: Record<string, string> = {
	'"': '\\"',
	"\\": "\\\\",
	"\b": "\\b",
	"\f": "\\f",
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
};
