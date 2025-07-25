import { CONFIG } from "../constants";
import type { TMock } from "../types";

const compiledPatterns = new Map<string, RegExp>();
const mockCache = new Map<string, TMock | null>();

export class MockManager {
	private mocks: TMock[] = [];
	private exactUrlMap = new Map<string, TMock>();
	private patternMocks: TMock[] = [];

	updateMocks(mocks: TMock[]): void {
		this.mocks = mocks.filter((mock) => mock.enabled !== false);
		this.rebuildIndexes();
		mockCache.clear();
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

	findMock(url: string, method: string = "GET"): TMock | null {
		if (this.mocks.length === 0) return null;

		const cacheKey = `${method.toLowerCase()}:${url}`;
		const cached = mockCache.get(cacheKey);
		if (cached !== undefined) return cached;

		const normalizedMethod = method.toLowerCase();
		const normalizedUrl = this.normalizeUrl(url);

		const exactKey = `${normalizedMethod}:${normalizedUrl}`;
		const exactMock = this.exactUrlMap.get(exactKey);
		if (exactMock) {
			this.cacheMock(cacheKey, exactMock);
			return exactMock;
		}

		for (const mock of this.patternMocks) {
			if (mock.method && mock.method.toLowerCase() !== normalizedMethod)
				continue;
			if (!mock.urlPattern) continue;

			let regex = compiledPatterns.get(mock.urlPattern);
			if (!regex) {
				try {
					regex = new RegExp(mock.urlPattern);
					if (compiledPatterns.size < CONFIG.CACHE_LIMITS.PATTERN_CACHE) {
						compiledPatterns.set(mock.urlPattern, regex);
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

	private cacheMock(key: string, mock: TMock | null): void {
		if (mockCache.size < CONFIG.CACHE_LIMITS.MOCK_CACHE) {
			mockCache.set(key, mock);
		}
	}

	private normalizeUrl(inputUrl: string): string {
		return inputUrl.startsWith("/")
			? window.location.origin + inputUrl
			: inputUrl;
	}

	static cleanupCaches(): void {
		if (mockCache.size > CONFIG.CACHE_LIMITS.MOCK_CACHE / 2) {
			mockCache.clear();
		}
		if (compiledPatterns.size > CONFIG.CACHE_LIMITS.PATTERN_CACHE / 2) {
			compiledPatterns.clear();
		}
	}
}
