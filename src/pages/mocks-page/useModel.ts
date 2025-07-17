import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMocks } from "@/shared/lib";
import type { TMock } from "@/shared/types";

export const useModel = () => {
	const navigate = useNavigate();
	const { mocks, toggleMock, removeMock, isLoading } = useMocks();

	const toggleMockActivity = (id: string) => (checked: boolean) =>
		toggleMock(id, checked);

	const handleDelete = (id: string) => () => {
		removeMock(id);
		toast.success("The mock has been deleted");
	};

	const handleEditClick = (mock: TMock) => () =>
		navigate("/update", {
			state: { data: mock },
		});

	return {
		mocks,
		toggleMockActivity,
		isLoading,
		handleDelete,
		handleEditClick,
	};
};
