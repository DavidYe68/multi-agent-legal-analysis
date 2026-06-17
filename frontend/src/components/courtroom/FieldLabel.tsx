import type { ReactNode } from "react";

/**
 * FieldLabel · 小节标题
 *
 * 中央争点区各小节（争点理由 / 引用证据 / 论证 / 法官认定 …）共用的克制说明文字：
 * 弱化字号与字色，让其下方的正文成为视觉重心。
 */
export default function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-1 font-label text-xs text-ink-caption">{children}</h4>
  );
}
