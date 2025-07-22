// background-state.ts
export class BackgroundState {
	private static instance: BackgroundState;

	public requestHistory: any[] = [];
	public mocks: any[] = [];
	public tabHistories: { [tabId: number]: any[] } = {};
	public tabDomains: { [tabId: number]: string } = {};
	public activeTabId: number | null = null;

	private constructor() {}

	public static getInstance(): BackgroundState {
		if (!BackgroundState.instance) {
			BackgroundState.instance = new BackgroundState();
		}
		return BackgroundState.instance;
	}

	public setActiveTabId(tabId: number | null) {
		this.activeTabId = tabId;
	}

	public getActiveTabId(): number | null {
		return this.activeTabId;
	}

	public setTabHistory(tabId: number, history: any[]) {
		this.tabHistories[tabId] = history;
	}

	public getTabHistory(tabId: number): any[] {
		return this.tabHistories[tabId] || [];
	}

	public setTabDomain(tabId: number, domain: string) {
		this.tabDomains[tabId] = domain;
	}

	public getTabDomain(tabId: number): string | undefined {
		return this.tabDomains[tabId];
	}

	public clearTabData(tabId: number) {
		delete this.tabHistories[tabId];
		delete this.tabDomains[tabId];
	}
}
