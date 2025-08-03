import { Pencil, Trash2 } from "lucide-react";
import {
	Badge,
	Button,
	EmptyBlock,
	Loader,
	PageLayout,
	Switch,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/shared/ui";
import { useModel } from "./useModel";

const MainPage = () => {
	const {
		mocks,
		toggleMockActivity,
		isLoading,
		handleEditClick,
		handleDelete,
	} = useModel();

	if (isLoading) {
		return <Loader />;
	}

	return (
		<PageLayout title="Mocks">
			{mocks.length ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[8%]">Active</TableHead>
							<TableHead className="w-[10%]">Request</TableHead>
							<TableHead className="w-[16%]">Name</TableHead>
							<TableHead className="w-[56%]">Url</TableHead>
							<TableHead className="w-[10%]" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{mocks.map((mock) => (
							<TableRow key={mock.name}>
								<TableCell>
									<Switch
										className="data-[state=checked]:bg-teal-600"
										checked={mock.enabled}
										onCheckedChange={toggleMockActivity(mock.id)}
									/>
								</TableCell>

								<TableCell>
									<div className="flex flex-wrap gap-1">
										<Badge className="h-4" variant="outline">
											{mock.method}
										</Badge>
										<Badge className="h-4" variant="outline">
											{mock.statusCode}
										</Badge>
									</div>
								</TableCell>

								<TableCell className="max-w-16" title={mock.name}>
									<div
										className="text-sm leading-5"
										style={{
											display: "-webkit-box",
											WebkitLineClamp: 2,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
											wordBreak: "break-all",
											maxHeight: "3rem",
										}}
									>
										{mock.name}
									</div>
								</TableCell>

								<TableCell className="max-w-60" title={mock.url}>
									<div
										className="text-sm leading-5"
										style={{
											display: "-webkit-box",
											WebkitLineClamp: 2,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
											wordBreak: "break-all",
											maxHeight: "3rem",
										}}
									>
										{mock.url}
									</div>
								</TableCell>

								<TableCell>
									<div className="flex gap-2 justify-end">
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="outline"
													size="icon"
													className="size-6"
													onClick={handleEditClick(mock)}
												>
													<Pencil />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Edit mock</p>
											</TooltipContent>
										</Tooltip>

										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="destructive"
													size="icon"
													className="size-6"
													onClick={handleDelete(mock.id)}
												>
													<Trash2 />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Delete mock</p>
											</TooltipContent>
										</Tooltip>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<EmptyBlock text="You don't have any mocks" />
			)}
		</PageLayout>
	);
};

export default MainPage;
