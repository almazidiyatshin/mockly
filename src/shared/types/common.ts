export type TLog = {
	id: number;
	isMocked: boolean;
	method: string;
	statusCode: number;
	timeStamp: number;
	url: string;
	responseBody: string;
};

export type TMock = {
	id: string;
	enabled: boolean;
	headers?: Record<string, string>;
	method: string;
	name: string;
	response?: string;
	url: string;
	statusCode: number;
};
