import { useEffect, useMemo, useState } from "react";
import { useMocks } from "@/shared/lib";
import type { TLog } from "@/shared/types";

export const useModel = () => {
	const [history, setHistory] = useState<TLog[]>([]);
	const { mocks } = useMocks();

	const sortedHitory = useMemo(
		() => history.sort((a, b) => (a.timeStamp < b.timeStamp ? 1 : -1)),
		[history],
	);

	useEffect(() => {
		if (
			typeof chrome !== "undefined" &&
			chrome.runtime &&
			chrome.runtime.sendMessage
		) {
			chrome.runtime.sendMessage({ type: "GET_HISTORY" }, (response) => {
				setHistory(response);
			});
		}
	}, []);

	return { history: sortedHitory, mocks };
};
