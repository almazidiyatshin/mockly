import { ignorePatterns } from "../constants/background";

export const notifyMocksUpdated = (mocks: any[]) => {
	chrome.runtime
		.sendMessage({
			type: "MOCKS_UPDATED",
			payload: mocks,
		})
		.catch(() => {});

	chrome.tabs.query({}, (tabs) => {
		tabs.forEach((tab) => {
			if (tab.id) {
				chrome.tabs
					.sendMessage(tab.id, {
						type: "MOCKS_UPDATED",
						payload: mocks,
					})
					.catch(() => {});
			}
		});
	});
};

export const shouldIgnore = (url: string) => {
	return ignorePatterns.some((pattern) => url.includes(pattern));
};
