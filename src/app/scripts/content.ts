import { MockManager } from "./lib/content";
import { MessageType, type MocklyMessage } from "./types";

const MOCKLY_PREFIX = "Mockly:" as const;

const mockManager = new MockManager();

const log = {
	debug: (message: string, ...args: any[]) =>
		console.debug(`${MOCKLY_PREFIX} ${message}`, ...args),
	error: (message: string, ...args: any[]) =>
		console.error(`${MOCKLY_PREFIX} ${message}`, ...args),
};

const handleRuntimeError = (context: string): void => {
	if (chrome.runtime.lastError) {
		log.debug(`${context}: ${chrome.runtime.lastError.message}`);
	}
};

const initializeMocks = async (): Promise<void> => {
	try {
		const response = await chrome.runtime.sendMessage({
			type: MessageType.GET_MOCKS,
		});

		if (response) {
			await mockManager.updateMocks(response);
		}
	} catch (error) {
		log.debug("Could not get mocks:", error);
	}
};

chrome.runtime.onMessage.addListener((message: MocklyMessage) => {
	if (message.type === MessageType.MOCKS_UPDATED && message.payload) {
		mockManager.updateMocks(message.payload);
	}
});

window.addEventListener("message", (event: MessageEvent) => {
	if (event.source !== window) return;

	const { data } = event;

	if (
		data.type === "MOCKLY_REQUEST_INTERCEPTED" ||
		data.type === "MOCKLY_REQUEST_COMPLETED"
	) {
		const payload = {
			url: data.url,
			method: data.method,
			responseBody: data.responseBody,
			statusCode: data.statusCode,
			isMocked: data.isMocked,
			mockId: data.mockId,
			timestamp: Date.now(),
		};

		try {
			chrome.runtime.sendMessage(
				{
					type: MessageType.LOG_REQUEST,
					payload,
				},
				() => handleRuntimeError("Could not log request"),
			);
		} catch (error) {
			log.debug("Error sending message:", error);
		}
	}
});

initializeMocks();
