import { Outlet, Route, Routes } from "react-router-dom";

import AppShell from "./layouts/AppShell";
import HomePage from "./pages/HomePage";
import CourtroomPage from "./pages/CourtroomPage";
import ReportPage from "./pages/ReportPage";
import ComparePage from "./pages/ComparePage";
import DatasetPage from "./pages/DatasetPage";
import NotFoundPage from "./pages/NotFoundPage";

/**
 * 布局路由：把 AppShell 套在所有页面外层，页面通过 <Outlet/> 渲染到中间区域。
 */
function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

/**
 * 路由表：
 *   /                     → HomePage（案件选择）
 *   /case/:caseId         → CourtroomPage（主工作台）
 *   /case/:caseId/report  → ReportPage（最终报告）
 *   /compare/:pairId      → ComparePage（A/B 对照）
 *   /dataset              → DatasetPage（数据集概览）
 */
export default function App() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/case/:caseId" element={<CourtroomPage />} />
        <Route path="/case/:caseId/report" element={<ReportPage />} />
        <Route path="/compare/:pairId" element={<ComparePage />} />
        <Route path="/dataset" element={<DatasetPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
