interface RequestHistoryEntry {
	id: string;
	url: string;
	method: string;
	timestamp: number;
	status?: number;
	[key: string]: any;
}

interface Mock {
	id: string;
	pattern: string;
	response: any;
	enabled: boolean;
	[key: string]: any;
}

interface TabData {
	history: RequestHistoryEntry[];
	domain?: string;
}

export class BackgroundState {
	private static instance: BackgroundState;

	private readonly tabData = new Map<number, TabData>();
	private readonly _requestHistory: RequestHistoryEntry[] = [];
	private _mocks: Mock[] = [];
	private _activeTabId: number | null = null;

	private constructor() {}

	public static getInstance(): BackgroundState {
		if (!BackgroundState.instance) {
			BackgroundState.instance = new BackgroundState();
		}
		return BackgroundState.instance;
	}

	public setActiveTabId(tabId: number | null): void {
		this._activeTabId = tabId;
	}

	public getActiveTabId(): number | null {
		return this._activeTabId;
	}

	public get requestHistory(): RequestHistoryEntry[] {
		return [...this._requestHistory];
	}

	public addRequestToHistory(entry: RequestHistoryEntry): void {
		this._requestHistory.push(entry);
	}

	public clearRequestHistory(): void {
		this._requestHistory.length = 0;
	}

	// Моки
	public get mocks(): Mock[] {
		return [...this._mocks];
	}

	public set mocks(mocks: Mock[]) {
		this._mocks = [...mocks];
	}

	public addMock(mock: Mock): void {
		this._mocks.push(mock);
	}

	public removeMock(mockId: string): boolean {
		const index = this._mocks.findIndex((m) => m.id === mockId);
		if (index !== -1) {
			this._mocks.splice(index, 1);
			return true;
		}
		return false;
	}

	public updateMock(mockId: string, updates: Partial<Mock>): boolean {
		const mock = this._mocks.find((m) => m.id === mockId);
		if (mock) {
			Object.assign(mock, updates);
			return true;
		}
		return false;
	}

	public setTabHistory(tabId: number, history: RequestHistoryEntry[]): void {
		const data = this.getOrCreateTabData(tabId);
		data.history = [...history];
	}

	public getTabHistory(tabId: number): RequestHistoryEntry[] {
		const data = this.tabData.get(tabId);
		return data ? [...data.history] : [];
	}

	public addToTabHistory(tabId: number, entry: RequestHistoryEntry): void {
		const data = this.getOrCreateTabData(tabId);
		data.history.push(entry);
	}

	public setTabDomain(tabId: number, domain: string): void {
		const data = this.getOrCreateTabData(tabId);
		data.domain = domain;
	}

	public getTabDomain(tabId: number): string | undefined {
		return this.tabData.get(tabId)?.domain;
	}

	public clearTabData(tabId: number): void {
		this.tabData.delete(tabId);
	}

	public hasTabData(tabId: number): boolean {
		return this.tabData.has(tabId);
	}

	public getAllTabIds(): number[] {
		return Array.from(this.tabData.keys());
	}

	public getTabCount(): number {
		return this.tabData.size;
	}

	public cleanupInactiveTabs(activeTabIds: Set<number>): number {
		let removedCount = 0;

		for (const tabId of this.tabData.keys()) {
			if (!activeTabIds.has(tabId)) {
				this.tabData.delete(tabId);
				removedCount++;
			}
		}

		return removedCount;
	}

	public getStats(): {
		totalTabs: number;
		totalHistoryEntries: number;
		totalMocks: number;
		activeMocks: number;
	} {
		let totalHistoryEntries = 0;

		for (const data of this.tabData.values()) {
			totalHistoryEntries += data.history.length;
		}

		return {
			totalTabs: this.tabData.size,
			totalHistoryEntries,
			totalMocks: this._mocks.length,
			activeMocks: this._mocks.filter((m) => m.enabled).length,
		};
	}

	private getOrCreateTabData(tabId: number): TabData {
		let data = this.tabData.get(tabId);

		if (!data) {
			data = {
				history: [],
				domain: undefined,
			};
			this.tabData.set(tabId, data);
		}

		return data;
	}

	public toJSON(): object {
		return {
			activeTabId: this._activeTabId,
			requestHistory: this._requestHistory,
			mocks: this._mocks,
			tabs: Object.fromEntries(this.tabData),
		};
	}
}
