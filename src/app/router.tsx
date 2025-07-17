import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Loader } from "@/shared/ui";

const MocksPage = lazy(() => import("@/pages/mocks-page"));
const LogsPage = lazy(() => import("@/pages/logs-page"));
const MockCreatePage = lazy(() => import("@/pages/mock-create-page"));
const MockUpdatePage = lazy(() => import("@/pages/mock-update-page"));

export const Router = () => (
	<HashRouter>
		<Suspense fallback={<Loader />}>
			<Routes>
				<Route path="/" element={<MocksPage />} />
				<Route path="/logs" element={<LogsPage />} />
				<Route path="/create" element={<MockCreatePage />} />
				<Route path="/update" element={<MockUpdatePage />} />
			</Routes>
		</Suspense>
	</HashRouter>
);
