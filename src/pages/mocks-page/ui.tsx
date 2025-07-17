import { Pencil, Trash2 } from "lucide-react";
import {
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
							<TableHead>Active</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Method</TableHead>
							<TableHead>Url</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{mocks.map((mock) => (
							<TableRow key={mock.name}>
								<TableCell className="flex items-center">
									<Switch
										className="data-[state=checked]:bg-teal-600"
										checked={mock.enabled}
										onCheckedChange={toggleMockActivity(mock.id)}
									/>
								</TableCell>

								<TableCell className="truncate overflow-hidden whitespace-nowrap max-w-16">
									{mock.name}
								</TableCell>

								<TableCell>{mock.method}</TableCell>

								<TableCell
									title={mock.url}
									className="truncate overflow-hidden whitespace-nowrap max-w-36"
								>
									{mock.url}
								</TableCell>

								<TableCell className="flex justify-end gap-2">
									<Button
										variant="outline"
										size="icon"
										className="size-6"
										onClick={handleEditClick(mock)}
									>
										<Pencil />
									</Button>
									<Button
										variant="destructive"
										size="icon"
										className="size-6"
										onClick={handleDelete(mock.id)}
									>
										<Trash2 />
									</Button>
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
