import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import z, { url } from "zod";
import { useMocks } from "@/shared/lib";
import type { TLog } from "@/shared/types";

export const useModel = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const data: TLog | undefined = location.state?.data;
	const { addMock } = useMocks();

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

	const form = useForm<z.infer<typeof ZFormSchema>>({
		resolver: zodResolver(ZFormSchema),
		defaultValues: {
			name: "",
			method: data?.method || "",
			url: data?.url || "",
			response: data?.responseBody || "",
			headers: [{ key: "", value: "" }],
			statusCode: 200,
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
			id: crypto.randomUUID(),
			enabled: true,
		};

		addMock(submitData).then(() => {
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
	};
};
