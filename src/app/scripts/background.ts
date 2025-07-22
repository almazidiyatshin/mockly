import { allowedTypes } from "./constants/background";
import {
	checkAndUpdateDomain,
	clearTabHistory,
	getActiveTabHistory,
	initialize,
	notifyHistoryUpdated,
	notifyMocksUpdated,
	shouldIgnore,
	updateActiveTab,
} from "./lib/background";
import { BackgroundState } from "./lib/background-state";

enum MessageType {
	LOG_REQUEST = "LOG_REQUEST",
	GET_DETAILED_HISTORY = "GET_DETAILED_HISTORY",
	GET_HISTORY = "GET_HISTORY",
	SET_MOCK = "SET_MOCK",
	GET_MOCKS = "GET_MOCKS",
	CLEAR_HISTORY = "CLEAR_HISTORY",
	CLEAR_DETAILED_HISTORY = "CLEAR_DETAILED_HISTORY",
	REMOVE_MOCK = "REMOVE_MOCK",
	UPDATE_MOCK = "UPDATE_MOCK",
	TOGGLE_MOCK = "TOGGLE_MOCK",
	CLEAR_ALL_MOCKS = "CLEAR_ALL_MOCKS",
}

interface Message<T = any> {
	type: MessageType;
	payload?: T;
}

interface RequestEntry {
	requestId: string;
	url: string;
	method: string;
	timeStamp: number;
	statusCode?: number;
}

interface DetailedRequestEntry extends RequestEntry {
	id: string;
	tabId: number;
	[key: string]: any;
}

const MAX_HISTORY_SIZE = 100;
const LOCALHOST_URL = "http://localhost:3005";

const state = BackgroundState.getInstance();

const createRequestEntry = (
	details: chrome.webRequest.WebResponseCacheDetails,
): RequestEntry => ({
	requestId: details.requestId,
	url: details.url,
	method: details.method,
	timeStamp: details.timeStamp,
	statusCode: details.statusCode,
});

const saveRequestHistory = async (): Promise<void> => {
	await chrome.storage.local.set({ requestHistory: state.requestHistory });
};

const saveMocks = async (): Promise<void> => {
	await chrome.storage.local.set({ mocks: state.mocks });
};

const handleTabRefresh = async (tabId: number): Promise<void> => {
	await clearTabHistory(tabId);
	console.log(`Tab ${tabId}: Page refreshed, history cleared`);

	if (tabId === state.getActiveTabId()) {
		notifyHistoryUpdated();
	}
};

const handleTabUrlChange = async (
	tabId: number,
	url: string,
): Promise<void> => {
	await checkAndUpdateDomain(tabId, url);

	if (tabId === state.getActiveTabId()) {
		notifyHistoryUpdated();
	}
};

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
	if (changeInfo.status === "loading" && !changeInfo.url) {
		await handleTabRefresh(tabId);
	}

	if (changeInfo.url) {
		await handleTabUrlChange(tabId, changeInfo.url);
	}
});

chrome.tabs.onActivated.addListener(updateActiveTab);

chrome.windows.onFocusChanged.addListener(async (windowId) => {
	if (windowId !== chrome.windows.WINDOW_ID_NONE) {
		await updateActiveTab();
	}
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
	state.clearTabData(tabId);
	await chrome.storage.local.remove([
		`tabHistory_${tabId}`,
		`tabDomain_${tabId}`,
	]);
});

chrome.runtime.onStartup.addListener(() => initialize(state));
chrome.runtime.onInstalled.addListener(() => initialize(state));

chrome.action.onClicked.addListener(() => {
	chrome.tabs.create({ url: LOCALHOST_URL });
});

chrome.webRequest.onCompleted.addListener(
	(details) => {
		if (
			!details.url.startsWith("http://") &&
			!details.url.startsWith("https://")
		) {
			return;
		}

		if (!allowedTypes.includes(details.type) || shouldIgnore(details.url)) {
			return;
		}

		const entry = createRequestEntry(details);
		//@ts-ignore
		state.addRequestToHistory(entry);

		if (state.requestHistory.length > MAX_HISTORY_SIZE) {
			state.requestHistory.shift();
		}

		saveRequestHistory();
	},
	{ urls: ["<all_urls>"] },
);

const messageHandlers: {
	[K in MessageType]: (
		message: Message,
		sender: chrome.runtime.MessageSender,
	) => Promise<any> | any;
} = {
	[MessageType.LOG_REQUEST]: async (message, sender) => {
		const tabId = sender.tab?.id || state.getActiveTabId();

		if (!tabId) {
			return { success: false, error: "No active tab" };
		}

		const detailedEntry: DetailedRequestEntry = {
			...message.payload,
			id: crypto.randomUUID(),
			tabId,
		};

		//@ts-ignore
		state.addToTabHistory(tabId, detailedEntry);

		const history = state.getTabHistory(tabId);
		if (history.length > MAX_HISTORY_SIZE) {
			history.shift();
			state.setTabHistory(tabId, history);
		}

		await chrome.storage.local.set({
			[`tabHistory_${tabId}`]: state.getTabHistory(tabId),
		});

		if (tabId === state.getActiveTabId()) {
			notifyHistoryUpdated(detailedEntry);
		}

		return { success: true };
	},

	[MessageType.GET_DETAILED_HISTORY]: () => {
		return getActiveTabHistory();
	},

	[MessageType.GET_HISTORY]: async () => {
		const result = await chrome.storage.local.get("requestHistory");
		return result.requestHistory || [];
	},

	[MessageType.SET_MOCK]: async (message) => {
		state.addMock(message.payload);
		await saveMocks();
		notifyMocksUpdated(state.mocks);
		return { success: true };
	},

	[MessageType.GET_MOCKS]: async () => {
		const result = await chrome.storage.local.get("mocks");
		state.mocks = result.mocks || [];
		return state.mocks;
	},

	[MessageType.CLEAR_HISTORY]: async () => {
		const activeTabId = state.getActiveTabId();
		if (activeTabId) {
			await clearTabHistory(activeTabId);
		}
		return { success: true };
	},

	[MessageType.CLEAR_DETAILED_HISTORY]: async () => {
		const activeTabId = state.getActiveTabId();
		if (activeTabId) {
			await clearTabHistory(activeTabId);
		}
		return { success: true };
	},

	[MessageType.REMOVE_MOCK]: async (message) => {
		const removed = state.removeMock(message.payload.id);
		if (removed) {
			await saveMocks();
			notifyMocksUpdated(state.mocks);
			return { success: true };
		}
		return { success: false, error: "Mock not found" };
	},

	[MessageType.UPDATE_MOCK]: async (message) => {
		const updated = state.updateMock(message.payload.id, message.payload);
		if (updated) {
			await saveMocks();
			notifyMocksUpdated(state.mocks);
			return { success: true };
		}
		return { success: false, error: "Mock not found" };
	},

	[MessageType.TOGGLE_MOCK]: async (message) => {
		const updated = state.updateMock(message.payload.id, {
			enabled: message.payload.enabled,
		});
		if (updated) {
			await saveMocks();
			notifyMocksUpdated(state.mocks);
			return { success: true };
		}
		return { success: false, error: "Mock not found" };
	},

	[MessageType.CLEAR_ALL_MOCKS]: async () => {
		state.mocks = [];
		await saveMocks();
		notifyMocksUpdated(state.mocks);
		return { success: true };
	},
};

chrome.runtime.onMessage.addListener(
	(
		message: Message,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response?: any) => void,
	) => {
		const handler = messageHandlers[message.type as MessageType];

		if (!handler) {
			console.warn(`Unknown message type: ${message.type}`);
			sendResponse({ success: false, error: "Unknown message type" });
			return false;
		}

		const result = handler(message, sender);

		if (result instanceof Promise) {
			result.then(sendResponse).catch((error) => {
				console.error(`Error handling message ${message.type}:`, error);
				sendResponse({ success: false, error: error.message });
			});
			return true;
		} else {
			sendResponse(result);
			return false;
		}
	},
);
