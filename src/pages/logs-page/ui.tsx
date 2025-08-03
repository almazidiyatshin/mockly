import { Link } from "react-router-dom";
import {
	Badge,
	Button,
	EmptyBlock,
	Loader,
	PageLayout,
	Table,
} from "@/shared/ui";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table/ui";
import { useModel } from "./useModel";

const LogsPage = () => {
	const { isLoading, history } = useModel();

	if (isLoading) {
		return <Loader />;
	}

	return (
		<PageLayout title="Logs">
			{history.length ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[10%]">Request</TableHead>
							<TableHead className="w-[80%]">Url</TableHead>
							<TableHead className="w-[10%]" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{history.map((log) => (
							<TableRow
								key={log.statusCode}
								className={log.isMocked ? "bg-teal-50" : ""}
							>
								<TableCell>
									<div className="flex flex-wrap gap-1">
										<Badge className="h-4" variant="outline">
											{log.method}
										</Badge>
										<Badge className="h-4" variant="outline">
											{log.statusCode}
										</Badge>
									</div>
								</TableCell>

								<TableCell className="max-w-60" title={log.url}>
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
										{log.url}
									</div>
								</TableCell>

								<TableCell className="text-right">
									{log.isMocked ? (
										<Button
											variant="outline"
											size="sm"
											className="p-2"
											disabled
										>
											Mocked
										</Button>
									) : (
										<Button asChild variant="outline" size="sm" className="p-2">
											<Link to="/create" state={{ data: log }}>
												Mock
											</Link>
										</Button>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<EmptyBlock text="There are no any logs" />
			)}
		</PageLayout>
	);
};

export default LogsPage;
