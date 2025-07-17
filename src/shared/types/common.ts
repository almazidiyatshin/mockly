export type TLog = {
	requestId: number;
	method: string;
	statusCode: number;
	timeStamp: number;
	url: string;
	enabled: boolean;
	delay: number;
	body: string;
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
