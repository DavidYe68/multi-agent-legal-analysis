import { useCourtroom, type RoleViewKey } from "./CourtroomContext";

/**
 * RoleViewSelector · 角色信息视图切换
 *
 * 位于卷宗栏顶部（案件摘要之上）。切换某个角色视图后：
 *   - 该角色不可见的事实/证据在列表里降透明度 + 删除线（由各列表读取 role_views）；
 *   - 这里显示一条提示条，底色用该角色色的 10% 透明度。
 */

interface ViewOption {
  value: RoleViewKey;
  label: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: "all", label: "全部" },
  { value: "prosecutor", label: "公诉方" },
  { value: "defense_lawyer", label: "辩护方" },
  { value: "defendant", label: "被告人" },
  { value: "judge", label: "法官" },
  { value: "reviewers", label: "评议者" },
];

/** 各角色视图对应的提示色（取设计令牌里的角色色）。 */
const VIEW_COLOR: Record<Exclude<RoleViewKey, "all">, string> = {
  prosecutor: "var(--role-prosecutor)",
  defense_lawyer: "var(--role-defense)",
  defendant: "var(--role-defendant)",
  judge: "var(--role-judge)",
  reviewers: "var(--role-legal-reviewer)",
};

const VIEW_LABEL: Record<RoleViewKey, string> = {
  all: "全部",
  prosecutor: "公诉方",
  defense_lawyer: "辩护方",
  defendant: "被告人",
  judge: "法官",
  reviewers: "评议者",
};

export default function RoleViewSelector() {
  const { roleView, setRoleView } = useCourtroom();

  return (
    <div className="border-b border-border bg-surface px-4 py-3">
      <label className="flex items-center gap-2 font-label text-xs text-ink-secondary">
        <span className="shrink-0">信息视图</span>
        <select
          value={roleView}
          onChange={(e) => setRoleView(e.target.value as RoleViewKey)}
          className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 py-1 font-label text-sm text-ink"
        >
          {VIEW_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {roleView !== "all" && (
        <div
          className="mt-2 rounded-sm px-2 py-1 font-label text-xs"
          style={{
            color: VIEW_COLOR[roleView],
            backgroundColor: `color-mix(in srgb, ${VIEW_COLOR[roleView]} 10%, transparent)`,
            borderLeft: `2px solid ${VIEW_COLOR[roleView]}`,
          }}
        >
          当前视图：{VIEW_LABEL[roleView]}可见信息
        </div>
      )}
    </div>
  );
}
