import { useLocation } from "react-router-dom";

export const useModel = () => {
	const location = useLocation();

	return { currentPath: location.pathname };
};
