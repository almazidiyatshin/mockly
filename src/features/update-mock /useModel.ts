import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import z, { url } from "zod";
import { useMocks } from "@/shared/lib";
import type { TMock } from "@/shared/types";

export const useModel = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const mock: TMock = location.state?.data;
	const { updateMock } = useMocks();

	const jsonStringSchema = z
		.string()
		.refine(
			(val) => {
				if (val === "") return true;

				try {
					JSON.parse(val);
					return true;
				} catch {
					return false;
				}
			},
			{
				message: "Невалидный JSON",
			},
		)
		.optional();

	const ZFormSchema = z.object({
		name: z.string().min(1, "Name is required"),
		method: z.string().min(1, "Method is required"),
		url: z.url("Invalid URL"),
		response: jsonStringSchema,
		headers: z
			.array(
				z.object({
					key: z.string(),
					value: z.string(),
				}),
			)
			.optional(),
		statusCode: z.number().min(1, "statusCode is required"),
	});

	const formatJson = (data: string) =>
		JSON.stringify(JSON.parse(data), null, 2);

	const form = useForm<z.infer<typeof ZFormSchema>>({
		resolver: zodResolver(ZFormSchema),
		defaultValues: {
			name: mock.name,
			method: mock.method,
			url: mock.url,
			response: mock.response ? formatJson(mock.response) : "",
			headers:
				mock.headers && !!Object.keys(mock.headers).length
					? Object.entries(mock.headers).map(([key, value]) => ({ key, value }))
					: [{ key: "", value: "" }],
			statusCode: mock.statusCode,
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "headers",
	});

	const addHeader = () => {
		append({ key: "", value: "" });
	};

	const removeHeader = (index: number) => () => {
		remove(index);

		if (index === 0) {
			append({ key: "", value: "" });
		}
	};

	const handleCancelClick = () => navigate("/");

	const handleSubmit = ({
		headers,
		...restData
	}: z.infer<typeof ZFormSchema>) => {
		const headersObject = headers?.reduce<Record<string, string>>(
			(acc, header) => {
				if (header.key && header.value) {
					acc[header.key] = header.value;
				}
				return acc;
			},
			{},
		);

		const submitData = {
			...restData,
			...(headersObject && { headers: headersObject }),
			id: mock.id,
			enabled: mock.enabled,
		};

		updateMock(mock.id, submitData).then(() => {
			form.reset({
				name: "",
				method: "",
				url: "",
				response: "",
				headers: [{ key: "", value: "" }],
				statusCode: 200,
			});

			navigate("/");
		});
	};

	return {
		form,
		url,
		fields,
		addHeader,
		removeHeader,
		handleSubmit,
		handleCancelClick,
	};
};
