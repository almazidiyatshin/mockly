import { ignorePatterns } from "../constants/background";
import { BackgroundState } from "./background-state";

interface Mock {
	[key: string]: any;
}

interface HistoryEntry {
	[key: string]: any;
}

interface HistoryPayload {
	newEntry?: HistoryEntry;
	fullHistory: HistoryEntry[];
	activeTabId: number | null;
}

const MESSAGE_TYPES = {
	MOCKS_UPDATED: "MOCKS_UPDATED",
	HISTORY_UPDATED: "HISTORY_UPDATED",
} as const;

const broadcastMessage = async (type: string, payload: any): Promise<void> => {
	try {
		await chrome.runtime.sendMessage({ type, payload });
	} catch {}

	const tabs = await chrome.tabs.query({});
	const sendPromises = tabs
		.filter((tab) => tab.id !== undefined)
		.map((tab) =>
			chrome.tabs.sendMessage(tab.id!, { type, payload }).catch(() => {}),
		);

	await Promise.all(sendPromises);
};

export const notifyMocksUpdated = (mocks: Mock[]): void => {
	broadcastMessage(MESSAGE_TYPES.MOCKS_UPDATED, mocks);
};

export const shouldIgnore = (url: string): boolean => {
	return ignorePatterns.some((pattern) => url.includes(pattern));
};

const getDomainFromUrl = (url: string): string => {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
};

export const getActiveTabHistory = (): HistoryEntry[] => {
	const state = BackgroundState.getInstance();
	const activeTabId = state.getActiveTabId();

	return activeTabId ? state.getTabHistory(activeTabId) : [];
};

export const notifyHistoryUpdated = (newEntry?: HistoryEntry): void => {
	const state = BackgroundState.getInstance();
	const payload: HistoryPayload = {
		newEntry,
		fullHistory: getActiveTabHistory(),
		activeTabId: state.getActiveTabId(),
	};

	broadcastMessage(MESSAGE_TYPES.HISTORY_UPDATED, payload);
};

export const saveTabHistory = async (tabId: number): Promise<void> => {
	const state = BackgroundState.getInstance();
	const data = {
		[`tabHistory_${tabId}`]: state.getTabHistory(tabId),
		[`tabDomain_${tabId}`]: state.getTabDomain(tabId) || "",
	};

	await chrome.storage.local.set(data);
};

export const loadTabHistory = async (tabId: number): Promise<void> => {
	const state = BackgroundState.getInstance();
	const keys = [`tabHistory_${tabId}`, `tabDomain_${tabId}`];

	const result = await chrome.storage.local.get(keys);

	state.setTabHistory(tabId, result[`tabHistory_${tabId}`] || []);

	if (result[`tabDomain_${tabId}`]) {
		state.setTabDomain(tabId, result[`tabDomain_${tabId}`]);
	}
};

export const clearTabHistory = async (tabId: number): Promise<void> => {
	const state = BackgroundState.getInstance();
	state.setTabHistory(tabId, []);

	await saveTabHistory(tabId);

	if (tabId === state.getActiveTabId()) {
		notifyHistoryUpdated();
	}
};

export const checkAndUpdateDomain = async (
	tabId: number,
	url: string,
): Promise<void> => {
	const state = BackgroundState.getInstance();
	const newDomain = getDomainFromUrl(url);

	if (!newDomain) return;

	const oldDomain = state.getTabDomain(tabId);

	if (oldDomain && oldDomain !== newDomain) {
		await clearTabHistory(tabId);
		console.log(
			`Tab ${tabId}: Domain changed from ${oldDomain} to ${newDomain}, history cleared`,
		);
	}

	state.setTabDomain(tabId, newDomain);
	await saveTabHistory(tabId);
};

export const updateActiveTab = async (): Promise<void> => {
	const state = BackgroundState.getInstance();

	const [activeTab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	});

	if (!activeTab?.id) return;

	const newActiveTabId = activeTab.id;
	const currentActiveTabId = state.getActiveTabId();

	if (currentActiveTabId !== newActiveTabId) {
		if (currentActiveTabId) {
			await saveTabHistory(currentActiveTabId);
		}

		state.setActiveTabId(newActiveTabId);
		await loadTabHistory(newActiveTabId);
		notifyHistoryUpdated();
	}

	if (activeTab.url) {
		const domain = getDomainFromUrl(activeTab.url);
		if (domain && state.getTabDomain(newActiveTabId) !== domain) {
			await checkAndUpdateDomain(newActiveTabId, activeTab.url);
		}
	}
};

export const initialize = async (state: BackgroundState): Promise<void> => {
	const { mocks = [] } = await chrome.storage.local.get(["mocks"]);
	state.mocks = mocks;
	notifyMocksUpdated(state.mocks);

	const tabs = await chrome.tabs.query({});
	const loadPromises = tabs
		.filter((tab) => tab.id !== undefined)
		.map((tab) => loadTabHistory(tab.id!));

	await Promise.all(loadPromises);

	await updateActiveTab();
};
