import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";
import { Router } from "./router";

export const App = () => {
	return (
		<TooltipProvider>
			<Router />
			<Toaster />
		</TooltipProvider>
	);
};
