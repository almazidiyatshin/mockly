import { setupMocking } from "./lib/content";

let currentMocks: any[] = [];

chrome.runtime.sendMessage({ type: "GET_MOCKS" }, (response) => {
	if (response) {
		currentMocks = response.filter((mock: any) => mock.enabled !== false);
		setupMocking(currentMocks);
	}
});

chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "MOCKS_UPDATED") {
		currentMocks = message.payload.filter(
			(mock: any) => mock.enabled !== false,
		);
		setupMocking(currentMocks);
	}
});
