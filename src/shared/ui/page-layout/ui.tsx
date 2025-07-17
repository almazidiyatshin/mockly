import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/lib";
import { Button } from "../button";
import { Label } from "../label";
import type { TPageLayoutProps } from "./types";
import { useModel } from "./useModel";

export const PageLayout = ({
	title,
	children,
}: PropsWithChildren<TPageLayoutProps>) => {
	const { currentPath } = useModel();

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<Label className="text-sm text-teal-600 font-mono">
						{"{ Mockly }"}
					</Label>
					<nav className="flex gap-4">
						<Button
							asChild
							variant={"link"}
							className={cn("p-0", currentPath === "/" && "text-teal-600")}
						>
							<Link to="/">Mocks</Link>
						</Button>

						<Button
							asChild
							variant={"link"}
							className={cn("p-0", currentPath === "/logs" && "text-teal-600")}
						>
							<Link to="/logs">Logs</Link>
						</Button>

						<Button
							asChild
							variant={"link"}
							className={cn(
								"p-0",
								currentPath === "/create" && "text-teal-600",
							)}
						>
							<Link to="/create">Create mock</Link>
						</Button>
					</nav>
				</div>
				<h1 className="text-xl font-semibold">{title}</h1>
			</div>
			{children}
		</div>
	);
};
