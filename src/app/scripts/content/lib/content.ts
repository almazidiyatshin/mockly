import type { Mock } from "../../types";

// Константы
const INTERCEPTOR_SCRIPT_ID = "mockly-interceptor";
const SCRIPT_LOAD_DELAY = 100;

export class MockManager {
	private currentMocks: Mock[] = [];
	private scriptLoaded = false;
	private pendingMocks: Mock[] | null = null;

	/**
	 * Обновляет моки и применяет их к странице
	 */
	async updateMocks(mocks: Mock[]): Promise<void> {
		this.currentMocks = mocks.filter((mock) => mock.enabled !== false);

		if (!this.scriptLoaded) {
			this.pendingMocks = this.currentMocks;
			await this.injectScript();
		} else {
			this.sendMocksToPage();
		}
	}

	/**
	 * Отправляет моки в interceptor script
	 */
	private sendMocksToPage(): void {
		window.postMessage(
			{
				type: "MOCKLY_MOCKS_UPDATE",
				mocks: this.currentMocks,
			},
			"*",
		);
	}

	/**
	 * Инжектирует скрипт в страницу
	 */
	private async injectScript(): Promise<void> {
		if (document.querySelector(`#${INTERCEPTOR_SCRIPT_ID}`)) {
			this.scriptLoaded = true;
			this.sendMocksToPage();
			return;
		}

		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.id = INTERCEPTOR_SCRIPT_ID;
			script.src = chrome.runtime.getURL("assets/interceptor.js");

			script.onload = () => {
				this.scriptLoaded = true;

				setTimeout(() => {
					if (this.pendingMocks) {
						this.currentMocks = this.pendingMocks;
						this.pendingMocks = null;
						this.sendMocksToPage();
					}
					resolve();
				}, SCRIPT_LOAD_DELAY);

				script.remove();
			};

			script.onerror = () => {
				console.error("Mockly: Failed to load interceptor script");
				script.remove();
				reject(new Error("Failed to load interceptor script"));
			};

			const target = document.head || document.documentElement;
			target.appendChild(script);
		});
	}

	/**
	 * Получает текущие активные моки
	 */
	getMocks(): Mock[] {
		return [...this.currentMocks];
	}

	/**
	 * Очищает все моки
	 */
	clearMocks(): void {
		this.currentMocks = [];
		this.sendMocksToPage();
	}
}
