import { ignorePatterns } from "../constants/background";
import { BackgroundState } from "./background-state";

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

const getDomainFromUrl = (url: string): string => {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch {
		return "";
	}
};

export const getActiveTabHistory = (): any[] => {
	const state = BackgroundState.getInstance();
	const activeTabId = state.getActiveTabId();

	if (activeTabId) {
		return state.getTabHistory(activeTabId);
	}
	return [];
};

export const notifyHistoryUpdated = (newEntry?: any) => {
	const state = BackgroundState.getInstance();
	const activeHistory = getActiveTabHistory();
	const activeTabId = state.getActiveTabId();

	chrome.runtime
		.sendMessage({
			type: "HISTORY_UPDATED",
			payload: {
				newEntry,
				fullHistory: activeHistory,
				activeTabId,
			},
		})
		.catch(() => {});

	chrome.tabs.query({}, (tabs) => {
		tabs.forEach((tab) => {
			if (tab.id) {
				chrome.tabs
					.sendMessage(tab.id, {
						type: "HISTORY_UPDATED",
						payload: {
							newEntry,
							fullHistory: activeHistory,
							activeTabId,
						},
					})
					.catch(() => {});
			}
		});
	});
};

export const saveTabHistory = (tabId: number) => {
	const state = BackgroundState.getInstance();
	const history = state.getTabHistory(tabId);
	const domain = state.getTabDomain(tabId);

	chrome.storage.local.set({
		[`tabHistory_${tabId}`]: history,
		[`tabDomain_${tabId}`]: domain || "",
	});
};

export const loadTabHistory = async (tabId: number): Promise<void> => {
	const state = BackgroundState.getInstance();

	return new Promise((resolve) => {
		chrome.storage.local.get(
			[`tabHistory_${tabId}`, `tabDomain_${tabId}`],
			(result) => {
				if (result[`tabHistory_${tabId}`]) {
					state.setTabHistory(tabId, result[`tabHistory_${tabId}`]);
				} else {
					state.setTabHistory(tabId, []);
				}

				if (result[`tabDomain_${tabId}`]) {
					state.setTabDomain(tabId, result[`tabDomain_${tabId}`]);
				}

				resolve();
			},
		);
	});
};

export const clearTabHistory = (tabId: number) => {
	const state = BackgroundState.getInstance();
	state.setTabHistory(tabId, []);

	saveTabHistory(tabId);

	if (tabId === state.getActiveTabId()) {
		notifyHistoryUpdated();
	}
};

export const checkAndUpdateDomain = (tabId: number, url: string) => {
	const state = BackgroundState.getInstance();
	const newDomain = getDomainFromUrl(url);
	const oldDomain = state.getTabDomain(tabId);

	if (oldDomain && oldDomain !== newDomain && newDomain !== "") {
		clearTabHistory(tabId);
		console.log(
			`Tab ${tabId}: Domain changed from ${oldDomain} to ${newDomain}, history cleared`,
		);
	}

	if (newDomain) {
		state.setTabDomain(tabId, newDomain);
		saveTabHistory(tabId);
	}
};

export const updateActiveTab = async () => {
	const state = BackgroundState.getInstance();

	chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
		if (tabs[0] && tabs[0].id) {
			const newActiveTabId = tabs[0].id;
			const currentActiveTabId = state.getActiveTabId();

			if (currentActiveTabId !== newActiveTabId) {
				if (currentActiveTabId) {
					saveTabHistory(currentActiveTabId);
				}

				state.setActiveTabId(newActiveTabId);

				await loadTabHistory(newActiveTabId);

				notifyHistoryUpdated();
			}

			if (tabs[0].url) {
				const domain = getDomainFromUrl(tabs[0].url);
				if (domain && state.getTabDomain(newActiveTabId) !== domain) {
					checkAndUpdateDomain(newActiveTabId, tabs[0].url);
				}
			}
		}
	});
};

export const initialize = async (state: BackgroundState) => {
	const result = await chrome.storage.local.get(["mocks"]);
	state.mocks = result.mocks || [];
	notifyMocksUpdated(state.mocks);

	chrome.tabs.query({}, async (tabs) => {
		for (const tab of tabs) {
			if (tab.id) {
				await loadTabHistory(tab.id);
			}
		}

		await updateActiveTab();
	});
};
