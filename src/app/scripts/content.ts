import { setupMocking } from "./lib/content";

let currentMocks: any[] = [];

chrome.runtime.sendMessage({ type: "GET_MOCKS" }, (response) => {
	if (chrome.runtime.lastError) {
		console.debug(
			"Mockly: Could not get mocks:",
			chrome.runtime.lastError.message,
		);
		return;
	}
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

window.addEventListener("message", (event) => {
	if (event.source !== window) return;

	if (
		event.data.type === "MOCKLY_REQUEST_INTERCEPTED" ||
		event.data.type === "MOCKLY_REQUEST_COMPLETED"
	) {
		try {
			chrome.runtime.sendMessage(
				{
					type: "LOG_REQUEST",
					payload: {
						url: event.data.url,
						method: event.data.method,
						responseBody: event.data.responseBody,
						statusCode: event.data.statusCode,
						isMocked: event.data.isMocked,
						mockId: event.data.mockId,
						timestamp: Date.now(),
					},
				},
				() => {
					if (chrome.runtime.lastError) {
						console.debug(
							"Mockly: Could not log request:",
							chrome.runtime.lastError.message,
						);
					}
				},
			);
		} catch (error) {
			console.debug("Mockly: Error sending message:", error);
		}
	}
});
