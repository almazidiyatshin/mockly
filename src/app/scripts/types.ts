export enum MessageType {
	GET_MOCKS = "GET_MOCKS",
	MOCKS_UPDATED = "MOCKS_UPDATED",
	LOG_REQUEST = "LOG_REQUEST",
}

export interface Mock {
	id: string;
	pattern: string;
	response: any;
	enabled: boolean;
	method?: string;
	delay?: number;
	statusCode?: number;
	headers?: Record<string, string>;
}

export interface MocklyMessage {
	type: MessageType;
	payload?: any;
}

export interface RequestLogPayload {
	url: string;
	method: string;
	responseBody?: any;
	statusCode?: number;
	isMocked: boolean;
	mockId?: string;
	timestamp: number;
}
