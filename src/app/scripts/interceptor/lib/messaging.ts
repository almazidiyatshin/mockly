import { CONFIG } from "../constants";
import type { TInterceptedRequest } from "../types";

let messageBatch: TInterceptedRequest[] = [];
let batchTimeout: number | null = null;

const requestPool: TInterceptedRequest[] = [];

export const createRequest = (): TInterceptedRequest => {
	return (
		requestPool.pop() || {
			type: "",
			url: "",
			method: "",
			responseBody: "",
			statusCode: 0,
			isMocked: false,
			timestamp: 0,
		}
	);
};

export const recycleRequest = (request: TInterceptedRequest) => {
	if (requestPool.length < CONFIG.CACHE_LIMITS.OBJECT_POOL) {
		requestPool.push(request);
	}
};

export const postMessageBatched = (data: TInterceptedRequest) => {
	messageBatch.push(data);

	if (messageBatch.length >= CONFIG.MESSAGE_BATCH_SIZE) {
		flushMessageBatch();
	} else if (batchTimeout === null) {
		batchTimeout = window.setTimeout(
			flushMessageBatch,
			CONFIG.MESSAGE_BATCH_DELAY,
		);
	}
};

const flushMessageBatch = () => {
	if (batchTimeout !== null) {
		clearTimeout(batchTimeout);
		batchTimeout = null;
	}

	if (messageBatch.length === 0) return;

	if ("requestIdleCallback" in window) {
		requestIdleCallback(() => {
			messageBatch.forEach((msg) => {
				window.postMessage(msg, "*");
				recycleRequest(msg);
			});
			messageBatch = [];
		});
	} else {
		setTimeout(() => {
			messageBatch.forEach((msg) => {
				window.postMessage(msg, "*");
				recycleRequest(msg);
			});
			messageBatch = [];
		}, 0);
	}
};
