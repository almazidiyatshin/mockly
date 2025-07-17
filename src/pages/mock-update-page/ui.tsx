import { MockUpdateForm } from "@/features";
import { PageLayout } from "@/shared/ui";

const MockUpdatePage = () => {
	return (
		<PageLayout title={"Update mock"}>
			<MockUpdateForm />
		</PageLayout>
	);
};

export default MockUpdatePage;
