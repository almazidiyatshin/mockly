import { useEffect, useState } from "react";
import type { TMock } from "@/shared/types";

export const useMocks = () => {
	const [mocks, setMocks] = useState<TMock[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		// Получаем начальный список
		if (
			typeof chrome !== "undefined" &&
			chrome.runtime &&
			chrome.runtime.sendMessage
		) {
			chrome.runtime.sendMessage({ type: "GET_MOCKS" }, (response) => {
				setMocks(response || []);
				setIsLoading(false);
			});

			// Слушаем обновления
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
						// Дополнительно уведомляем активные табы (для Manifest V3)
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
					// Дополнительно уведомляем активные табы (для Manifest V3)
					if (response?.success) {
						notifyActiveTabsAboutMocks();
					}
					resolve(response);
				},
			);
		});
	};

	// Функция для уведомления активных табов о изменениях моков
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
							.catch(() => {}); // Игнорируем ошибки для неактивных табов
					}
				});
			});
		}
	};

	// Дополнительная функция для обновления конкретного мока
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

	// Функция для включения/выключения мока
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

	// Функция для очистки всех моков
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
