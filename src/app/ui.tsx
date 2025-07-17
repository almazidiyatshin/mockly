import { Toaster } from "sonner";
import { Router } from "./router";

export const App = () => {
	return (
		<>
			<Router />
			<Toaster />
		</>
	);
};
