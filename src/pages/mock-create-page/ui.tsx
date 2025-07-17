import { MockCreateForm } from "@/features";
import { PageLayout } from "@/shared/ui";

const MockCreatePage = () => {
	return (
		<PageLayout title={"Create new mock"}>
			<MockCreateForm />
		</PageLayout>
	);
};

export default MockCreatePage;
