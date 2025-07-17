import { allowedTypes } from "./constants/background";
import { notifyMocksUpdated, shouldIgnore } from "./lib/background";

let requestHistory: any[] = [];
let mocks: any[] = [];

chrome.runtime.onStartup.addListener(async () => {
	const result = await chrome.storage.local.get("mocks");
	mocks = result.mocks || [];
	notifyMocksUpdated(mocks);
});

chrome.runtime.onInstalled.addListener(async () => {
	const result = await chrome.storage.local.get("mocks");
	mocks = result.mocks || [];
	notifyMocksUpdated(mocks);
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
			chrome.storage.local.set({ requestHistory: [] }, () => {
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
