export const updateMocksInPage = (currentMocks: any[]) => {
	window.postMessage(
		{
			type: "MOCKLY_MOCKS_UPDATE",
			mocks: currentMocks,
		},
		"*",
	);
};

export const setupMocking = (currentMocks: any[]) => {
	if (document.querySelector("#mockly-injected")) {
		updateMocksInPage(currentMocks);
		return;
	}

	const script = document.createElement("script");
	script.id = "mockly-injected";
	script.src = chrome.runtime.getURL("assets/injected.js");

	script.onload = () => {
		setTimeout(() => updateMocksInPage(currentMocks), 100);
		script.remove();
	};

	script.onerror = () => {
		console.error("Mockly: Failed to load injected script");
		script.remove();
	};

	(document.head || document.documentElement).appendChild(script);
};
