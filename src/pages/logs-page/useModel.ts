import { useEffect, useMemo, useState } from "react";
import type { TLog } from "@/shared/types";

export const useModel = () => {
	const [history, setHistory] = useState<TLog[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const sortedHistory = useMemo(
		() => history.sort((a, b) => (a.timeStamp < b.timeStamp ? 1 : -1)),
		[history],
	);

	useEffect(() => {
		if (
			typeof chrome !== "undefined" &&
			chrome.runtime &&
			chrome.runtime.sendMessage
		) {
			chrome.runtime.sendMessage(
				{ type: "GET_DETAILED_HISTORY" },
				(response) => {
					if (response) {
						setHistory(response);
						setIsLoading(false);
					}
				},
			);
		}

		const handleMessage = (message: any) => {
			if (message.type === "HISTORY_UPDATED") {
				if (message.payload.fullHistory) {
					setHistory(message.payload.fullHistory);
				} else if (message.payload.newEntry) {
					setHistory((prev) => {
						const newHistory = [...prev, message.payload.newEntry];
						if (newHistory.length > 100) {
							return newHistory.slice(-100);
						}
						return newHistory;
					});
				}
			}
		};

		if (chrome?.runtime?.onMessage) {
			chrome.runtime.onMessage.addListener(handleMessage);
		}

		return () => {
			if (chrome?.runtime?.onMessage) {
				chrome.runtime.onMessage.removeListener(handleMessage);
			}
		};
	}, []);

	return {
		isLoading,
		history: sortedHistory,
	};
};
