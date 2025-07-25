export type TMock = {
	id: string;
	url?: string;
	urlPattern?: string;
	method?: string;
	response: any;
	statusCode?: number;
	headers?: Record<string, string>;
	delay?: number;
	enabled?: boolean;
};

export type TInterceptedRequest = {
	type: string;
	url: string;
	method: string;
	mockId?: string;
	responseBody: string;
	statusCode: number;
	isMocked: boolean;
	timestamp: number;
	error?: string;
};
