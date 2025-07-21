import { Braces } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/lib";
import { Button, EmptyBlock, PageLayout, Table } from "@/shared/ui";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table/ui";
import { useModel } from "./useModel";

const LogsPage = () => {
	const { history } = useModel();

	return (
		<PageLayout title="Logs">
			{history.length ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Status</TableHead>
							<TableHead>Method</TableHead>
							<TableHead>Url</TableHead>
							<TableHead></TableHead>
							<TableHead></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{history.map((log) => (
							<TableRow key={log.statusCode}>
								<TableCell
									className={cn("font-medium", log.isMocked && "text-teal-600")}
								>
									{log.statusCode}
								</TableCell>
								<TableCell className={cn(log.isMocked && "text-teal-600")}>
									{log.method}
								</TableCell>
								<TableCell
									title={log.url}
									className={cn(
										"truncate overflow-hidden whitespace-nowrap max-w-xs",
										log.isMocked && "text-teal-600",
									)}
								>
									{log.url}
								</TableCell>
								<TableCell className="text-">
									{log.isMocked && (
										<Braces size={20} className="text-teal-600" />
									)}
								</TableCell>
								<TableCell className="text-right">
									{log.isMocked ? (
										<Button
											variant="outline"
											size="sm"
											className="p-2"
											disabled
										>
											Mock
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
