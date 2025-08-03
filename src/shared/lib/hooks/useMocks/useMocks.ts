import { useEffect, useState } from "react";
import type { TMock } from "@/shared/types";

export const useMocks = () => {
	const [mocks, setMocks] = useState<TMock[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (
			typeof chrome !== "undefined" &&
			chrome.runtime &&
			chrome.runtime.sendMessage
		) {
			chrome.runtime.sendMessage({ type: "GET_MOCKS" }, (response) => {
				setMocks(response || []);
				setIsLoading(false);
			});

			const handleMessage = (message: any) => {
				if (message.type === "MOCKS_UPDATED") {
					setMocks(message.payload);
				}
			};

			chrome.runtime.onMessage.addListener(handleMessage);

			return () => chrome.runtime.onMessage.removeListener(handleMessage);
		}
	}, []);

	const addMock = (mock: TMock) => {
		return new Promise((resolve) => {
			if (
				typeof chrome !== "undefined" &&
				chrome.runtime &&
				chrome.runtime.sendMessage
			) {
				chrome.runtime.sendMessage(
					{
						type: "SET_MOCK",
						payload: mock,
					},
					(response) => {
						if (response?.success) {
							notifyActiveTabsAboutMocks();
						}
						resolve(response);
					},
				);
			}
		});
	};

	const removeMock = (id: string) => {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage(
				{
					type: "REMOVE_MOCK",
					payload: { id },
				},
				(response) => {
					if (response?.success) {
						notifyActiveTabsAboutMocks();
					}
					resolve(response);
				},
			);
		});
	};

	const notifyActiveTabsAboutMocks = () => {
		if (chrome.tabs) {
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
		}
	};

	const updateMock = (id: string, updatedMock: any) => {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage(
				{
					type: "UPDATE_MOCK",
					payload: { id, ...updatedMock },
				},
				(response) => {
					if (response?.success) {
						notifyActiveTabsAboutMocks();
					}
					resolve(response);
				},
			);
		});
	};

	const toggleMock = (id: string, enabled: boolean) => {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage(
				{
					type: "TOGGLE_MOCK",
					payload: { id, enabled },
				},
				(response) => {
					if (response?.success) {
						notifyActiveTabsAboutMocks();
					}
					resolve(response);
				},
			);
		});
	};

	const clearAllMocks = () => {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage(
				{
					type: "CLEAR_ALL_MOCKS",
				},
				(response) => {
					if (response?.success) {
						notifyActiveTabsAboutMocks();
					}
					resolve(response);
				},
			);
		});
	};

	return {
		mocks,
		isLoading,
		addMock,
		removeMock,
		updateMock,
		toggleMock,
		clearAllMocks,
	};
};
