import { allowedTypes } from "./constants/background";
import {
	checkAndUpdateDomain,
	clearTabHistory,
	getActiveTabHistory,
	loadTabHistory,
	notifyHistoryUpdated,
	notifyMocksUpdated,
	shouldIgnore,
	updateActiveTab,
} from "./lib/background";
import { BackgroundState } from "./lib/background-state";

const state = BackgroundState.getInstance();

// Инициализация при запуске
const initialize = async () => {
	// Загружаем моки
	const result = await chrome.storage.local.get(["mocks"]);
	state.mocks = result.mocks || [];
	notifyMocksUpdated(state.mocks);

	// Восстанавливаем историю для всех открытых вкладок
	chrome.tabs.query({}, async (tabs) => {
		for (const tab of tabs) {
			if (tab.id) {
				await loadTabHistory(tab.id);
			}
		}

		// Инициализируем активную вкладку
		await updateActiveTab();
	});
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo.url) {
		checkAndUpdateDomain(tabId, changeInfo.url);

		if (tabId === state.getActiveTabId()) {
			notifyHistoryUpdated();
		}
	}
});

chrome.tabs.onActivated.addListener(() => {
	updateActiveTab();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
	if (windowId !== chrome.windows.WINDOW_ID_NONE) {
		updateActiveTab();
	}
});

chrome.tabs.onRemoved.addListener((tabId) => {
	state.clearTabData(tabId);
	chrome.storage.local.remove([`tabHistory_${tabId}`, `tabDomain_${tabId}`]);
});

chrome.runtime.onStartup.addListener(() => {
	initialize();
});

chrome.runtime.onInstalled.addListener(() => {
	initialize();
});

chrome.action.onClicked.addListener(() => {
	chrome.tabs.create({ url: "http://localhost:3005" });
});

chrome.webRequest.onCompleted.addListener(
	({ url, type, requestId, method, timeStamp, statusCode }) => {
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			return;
		}
		if (!allowedTypes.includes(type)) {
			return;
		}
		if (shouldIgnore(url)) {
			return;
		}

		const entry = {
			requestId,
			url,
			method,
			timeStamp,
			statusCode,
		};
		state.requestHistory.push(entry);

		if (state.requestHistory.length > 100) state.requestHistory.shift();

		chrome.storage.local.set({ requestHistory: state.requestHistory });
	},
	{ urls: ["<all_urls>"] },
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.type) {
		case "LOG_REQUEST": {
			const tabId = sender.tab?.id || state.getActiveTabId();

			if (!tabId) {
				sendResponse({ success: false, error: "No active tab" });
				return true;
			}

			const history = state.getTabHistory(tabId);

			const detailedEntry = {
				...message.payload,
				id: crypto.randomUUID(),
				tabId,
			};

			history.push(detailedEntry);

			if (history.length > 100) {
				history.shift();
			}

			state.setTabHistory(tabId, history);

			chrome.storage.local.set(
				{
					[`tabHistory_${tabId}`]: history,
				},
				() => {
					if (tabId === state.getActiveTabId()) {
						notifyHistoryUpdated(detailedEntry);
					}
				},
			);

			sendResponse({ success: true });
			return true;
		}

		case "GET_DETAILED_HISTORY":
			sendResponse(getActiveTabHistory());
			return true;

		case "GET_HISTORY":
			chrome.storage.local.get("requestHistory", (result) => {
				sendResponse(result.requestHistory || []);
			});
			return true;

		case "SET_MOCK":
			state.mocks.push(message.payload);
			chrome.storage.local.set({ mocks: state.mocks }, () => {
				notifyMocksUpdated(state.mocks);
				sendResponse({ success: true });
			});
			return true;

		case "GET_MOCKS":
			chrome.storage.local.get("mocks", (result) => {
				state.mocks = result.mocks || [];
				sendResponse(state.mocks);
			});
			return true;

		case "CLEAR_HISTORY": {
			const activeTabId = state.getActiveTabId();
			if (activeTabId) {
				clearTabHistory(activeTabId);
			}
			sendResponse({ success: true });
			return true;
		}

		case "CLEAR_DETAILED_HISTORY": {
			const activeTab = state.getActiveTabId();
			if (activeTab) {
				clearTabHistory(activeTab);
			}
			sendResponse({ success: true });
			return true;
		}

		case "REMOVE_MOCK":
			state.mocks = state.mocks.filter((m) => m.id !== message.payload.id);
			chrome.storage.local.set({ mocks: state.mocks }, () => {
				notifyMocksUpdated(state.mocks);
				sendResponse({ success: true });
			});
			return true;

		case "UPDATE_MOCK": {
			const mockIndex = state.mocks.findIndex(
				(m) => m.id === message.payload.id,
			);
			if (mockIndex !== -1) {
				state.mocks[mockIndex] = {
					...state.mocks[mockIndex],
					...message.payload,
				};
				chrome.storage.local.set({ mocks: state.mocks }, () => {
					notifyMocksUpdated(state.mocks);
					sendResponse({ success: true });
				});
			} else {
				sendResponse({ success: false, error: "Mock not found" });
			}
			return true;
		}

		case "TOGGLE_MOCK": {
			const toggleIndex = state.mocks.findIndex(
				(m) => m.id === message.payload.id,
			);
			if (toggleIndex !== -1) {
				state.mocks[toggleIndex].enabled = message.payload.enabled;
				chrome.storage.local.set({ mocks: state.mocks }, () => {
					notifyMocksUpdated(state.mocks);
					sendResponse({ success: true });
				});
			} else {
				sendResponse({ success: false, error: "Mock not found" });
			}
			return true;
		}

		case "CLEAR_ALL_MOCKS":
			state.mocks = [];
			chrome.storage.local.set({ mocks: [] }, () => {
				notifyMocksUpdated(state.mocks);
				sendResponse({ success: true });
			});
			return true;
	}
});
