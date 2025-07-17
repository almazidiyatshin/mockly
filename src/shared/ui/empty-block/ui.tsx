import { Meh } from "lucide-react";
import type { TEmptyBlockProps } from "./types";

export const EmptyBlock = ({ text }: TEmptyBlockProps) => (
	<div className="flex items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
		<div className="flex flex-col items-center text-center gap-2">
			<Meh size={40} />
			<p className="text-xl">{text}</p>
		</div>
	</div>
);
