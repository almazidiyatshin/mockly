import { Plus, X } from "lucide-react";
import {
	Button,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	Textarea,
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/ui";
import { useModel } from "./useModel";

export const MockUpdateForm = () => {
	const {
		form,
		fields,
		addHeader,
		removeHeader,
		handleSubmit,
		handleCancelClick,
	} = useModel();

	return (
		<Form {...form}>
			<form
				className="flex flex-col gap-6"
				onSubmit={form.handleSubmit(handleSubmit)}
			>
				<div className="flex flex-col gap-2">
					<div className="grid grid-cols-6 gap-3">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem className="col-span-4">
									<FormLabel>Mock name</FormLabel>
									<FormControl>
										<Input placeholder="Type mock name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="method"
							render={({ field }) => (
								<FormItem className="col-span-2">
									<FormLabel>Method</FormLabel>
									<ToggleGroup
										className="flex gap-2"
										variant="default"
										type="single"
										value={field.value}
										onValueChange={field.onChange}
									>
										<ToggleGroupItem value="GET">GET</ToggleGroupItem>
										<ToggleGroupItem value="POST">POST</ToggleGroupItem>
										<ToggleGroupItem value="PUT">PUT</ToggleGroupItem>
										<ToggleGroupItem value="DELETE">DELETE</ToggleGroupItem>
									</ToggleGroup>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="grid grid-cols-6 gap-3">
						<FormField
							control={form.control}
							name="statusCode"
							render={({ field }) => (
								<FormItem className="col-span-1">
									<FormLabel>Status</FormLabel>
									<FormControl>
										<Input
											placeholder="Type status"
											{...field}
											type="number"
											onChange={(e) => {
												const value = e.target.valueAsNumber;
												field.onChange(Number.isNaN(value) ? undefined : value);
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="url"
							render={({ field }) => (
								<FormItem className="col-span-5">
									<FormLabel>Url</FormLabel>
									<FormControl>
										<Input placeholder="Type url" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<FormLabel>Headers</FormLabel>
						{fields.map((field, index) => (
							<div key={field.id} className="flex items-start gap-2">
								<FormField
									control={form.control}
									name={`headers.${index}.key`}
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormControl>
												<Input placeholder="Content-Type" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name={`headers.${index}.value`}
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormControl>
												<Input placeholder="application/json" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<Button
									type="button"
									variant="outline"
									onClick={removeHeader(index)}
									// disabled={fields.length === 1}
								>
									<X />
								</Button>
							</div>
						))}

						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="p-2 w-fit ml-auto"
							onClick={addHeader}
						>
							<Plus />
							Add header
						</Button>
					</div>

					<FormField
						control={form.control}
						name="response"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Response</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Type response JSON"
										rows={16}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="flex justify-end gap-4">
					<Button className="bg-teal-600 hover:bg-teal-700" type="submit">
						Save mock
					</Button>
					<Button
						type="button"
						variant={"destructive"}
						onClick={handleCancelClick}
					>
						Cancel
					</Button>
				</div>
			</form>
		</Form>
	);
};
