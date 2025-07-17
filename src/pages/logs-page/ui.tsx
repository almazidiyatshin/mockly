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
	const { history, mocks } = useModel();

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
									className={cn(
										"font-medium",
										!!mocks.find(
											(mock) =>
												mock.url === log.url && mock.method === log.method,
										) && "text-teal-600",
									)}
								>
									{mocks.find(
										(mock) =>
											mock.url === log.url && mock.method === log.method,
									)?.statusCode || log.statusCode}
								</TableCell>
								<TableCell
									className={cn(
										!!mocks.find(
											(mock) =>
												mock.url === log.url && mock.method === log.method,
										) && "text-teal-600",
									)}
								>
									{log.method}
								</TableCell>
								<TableCell
									title={log.url}
									className={cn(
										"truncate overflow-hidden whitespace-nowrap max-w-xs",
										!!mocks.find(
											(mock) =>
												mock.url === log.url && mock.method === log.method,
										) && "text-teal-600",
									)}
								>
									{log.url}
								</TableCell>
								<TableCell className="text-">
									{!!mocks.find(
										(mock) =>
											mock.url === log.url && mock.method === log.method,
									) && <Braces size={20} className="text-teal-600" />}
								</TableCell>
								<TableCell className="text-right">
									{mocks.find(
										(mock) =>
											mock.url === log.url && mock.method === log.method,
									) ? (
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
