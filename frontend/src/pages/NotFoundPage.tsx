import { Link } from "react-router-dom";

import PagePlaceholder from "../components/PagePlaceholder";

/** NotFoundPage · 404（占位）。 */
export default function NotFoundPage() {
  return (
    <PagePlaceholder title="页面不存在" subtitle="404">
      <Link to="/" className="font-label text-sm text-role-defense underline">
        返回案件选择
      </Link>
    </PagePlaceholder>
  );
}
