import { allowedTypes } from "./constants/background";
import { notifyMocksUpdated, shouldIgnore } from "./lib/background";

let requestHistory: any[] = [];
let mocks: any[] = [];
let detailedRequestHistory: any[] = [];

let currentDomain: string = "";

const getDomainFromUrl = (url: string): string => {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch (e) {
		return "";
	}
};

const notifyHistoryUpdated = (newEntry?: any) => {
	chrome.runtime
		.sendMessage({
			type: "HISTORY_UPDATED",
			payload: {
				newEntry,
				fullHistory: detailedRequestHistory,
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
							fullHistory: detailedRequestHistory,
						},
					})
					.catch(() => {});
			}
		});
	});
};

const clearHistory = () => {
	requestHistory = [];
	detailedRequestHistory = [];

	chrome.storage.local.set({
		requestHistory: [],
		detailedRequestHistory: [],
	});
};

const checkAndUpdateDomain = () => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		if (tabs[0] && tabs[0].url) {
			const newDomain = getDomainFromUrl(tabs[0].url);

			// Если домен изменился, очищаем историю
			if (currentDomain && currentDomain !== newDomain && newDomain !== "") {
				clearHistory();
				notifyHistoryUpdated();
				console.log(
					`Domain changed from ${currentDomain} to ${newDomain}, history cleared`,
				);
			}

			// Обновляем текущий домен
			if (newDomain) {
				currentDomain = newDomain;
			}
		}
	});
};

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
	if (changeInfo.url && tab.active) {
		checkAndUpdateDomain();
	}
});

chrome.tabs.onActivated.addListener(() => {
	checkAndUpdateDomain();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
	if (windowId !== chrome.windows.WINDOW_ID_NONE) {
		checkAndUpdateDomain();
	}
});

chrome.runtime.onStartup.addListener(async () => {
	const result = await chrome.storage.local.get([
		"mocks",
		"detailedRequestHistory",
	]);
	mocks = result.mocks || [];
	detailedRequestHistory = result.detailedRequestHistory || [];
	notifyMocksUpdated(mocks);
	checkAndUpdateDomain();
});

chrome.runtime.onInstalled.addListener(async () => {
	const result = await chrome.storage.local.get([
		"mocks",
		"detailedRequestHistory",
	]);
	mocks = result.mocks || [];
	detailedRequestHistory = result.detailedRequestHistory || [];
	notifyMocksUpdated(mocks);
	checkAndUpdateDomain();
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
		requestHistory.push(entry);

		if (requestHistory.length > 100) requestHistory.shift();

		chrome.storage.local.set({ requestHistory });
	},
	{ urls: ["<all_urls>"] },
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	switch (message.type) {
		case "LOG_REQUEST": {
			const detailedEntry = {
				...message.payload,
				id: crypto.randomUUID(),
			};

			detailedRequestHistory.push(detailedEntry);

			if (detailedRequestHistory.length > 100) {
				detailedRequestHistory.shift();
			}

			chrome.storage.local.set({ detailedRequestHistory }, () => {
				notifyHistoryUpdated(detailedEntry);
			});

			sendResponse({ success: true });
			return true;
		}

		case "GET_DETAILED_HISTORY":
			chrome.storage.local.get("detailedRequestHistory", (result) => {
				sendResponse(result.detailedRequestHistory || []);
			});
			return true;

		case "GET_HISTORY":
			chrome.storage.local.get("requestHistory", (result) => {
				sendResponse(result.requestHistory || []);
			});
			return true;

		case "SET_MOCK":
			mocks.push(message.payload);
			chrome.storage.local.set({ mocks }, () => {
				notifyMocksUpdated(mocks);
				sendResponse({ success: true });
			});
			return true;

		case "GET_MOCKS":
			chrome.storage.local.get("mocks", (result) => {
				mocks = result.mocks || [];
				sendResponse(mocks);
			});
			return true;

		case "CLEAR_HISTORY":
			requestHistory = [];
			detailedRequestHistory = [];
			chrome.storage.local.set(
				{
					requestHistory: [],
					detailedRequestHistory: [],
				},
				() => {
					notifyHistoryUpdated();
					sendResponse({ success: true });
				},
			);
			return true;

		case "CLEAR_DETAILED_HISTORY":
			detailedRequestHistory = [];
			chrome.storage.local.set({ detailedRequestHistory: [] }, () => {
				notifyHistoryUpdated();
				sendResponse({ success: true });
			});
			return true;

		case "REMOVE_MOCK":
			mocks = mocks.filter((m) => m.id !== message.payload.id);
			chrome.storage.local.set({ mocks }, () => {
				notifyMocksUpdated(mocks);
				sendResponse({ success: true });
			});
			return true;

		case "UPDATE_MOCK": {
			const mockIndex = mocks.findIndex((m) => m.id === message.payload.id);
			if (mockIndex !== -1) {
				mocks[mockIndex] = { ...mocks[mockIndex], ...message.payload };
				chrome.storage.local.set({ mocks }, () => {
					notifyMocksUpdated(mocks);
					sendResponse({ success: true });
				});
			} else {
				sendResponse({ success: false, error: "Mock not found" });
			}
			return true;
		}

		case "TOGGLE_MOCK": {
			const toggleIndex = mocks.findIndex((m) => m.id === message.payload.id);
			if (toggleIndex !== -1) {
				mocks[toggleIndex].enabled = message.payload.enabled;
				chrome.storage.local.set({ mocks }, () => {
					notifyMocksUpdated(mocks);
					sendResponse({ success: true });
				});
			} else {
				sendResponse({ success: false, error: "Mock not found" });
			}
			return true;
		}

		case "CLEAR_ALL_MOCKS":
			mocks = [];
			chrome.storage.local.set({ mocks: [] }, () => {
				notifyMocksUpdated(mocks);
				sendResponse({ success: true });
			});
			return true;
	}
});
