import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/**
 * 设计系统 · Tailwind 配置
 * 多智能体法律推理系统
 *
 * 所有取值都引用 src/styles/tokens.css 里的 CSS 变量，tokens.css 是唯一真源。
 *
 * 关于颜色：这里用顶层 `theme.colors` 整体替换调色板，而不是 `extend.colors`。
 * 原因——extend 是「合并」语义，Tailwind 默认色板（blue-500 等）会被保留；
 * 而需求是「严格使用设计令牌、不要用 Tailwind 默认色板」，同时保留
 * black / white / transparent / currentColor。要同时满足这两点，只能整体替换。
 * 其余维度（间距、圆角、字体、字号）按需求用 `extend` 叠加，不丢失默认值。
 */
const config = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    // —— 颜色：整体替换默认调色板，仅保留三个原语 + 设计令牌 ——
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      black: "#000000",
      white: "#ffffff",

      // 背景
      shell: "var(--bg-shell)",
      surface: {
        DEFAULT: "var(--bg-surface)",
        alt: "var(--bg-surface-alt)",
      },
      elevated: "var(--bg-elevated)",

      // 边框 / 强调（border-border = 默认边框色，border-emphasis = 黄铜强调）
      border: {
        DEFAULT: "var(--border-default)",
        emphasis: "var(--border-emphasis)",
      },

      // 文本（ink 取「墨」之意，呼应司法文书）：text-ink / text-ink-secondary ...
      ink: {
        DEFAULT: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        caption: "var(--text-caption)",
        "on-dark": "var(--text-on-dark)",
      },

      // 角色（仅用于小面积标识，不铺满）
      role: {
        prosecutor: "var(--role-prosecutor)",
        defense: "var(--role-defense)",
        defendant: "var(--role-defendant)",
        judge: "var(--role-judge)",
        "legal-reviewer": "var(--role-legal-reviewer)",
        "social-reviewer": "var(--role-social-reviewer)",
        "expert-reviewer": "var(--role-expert-reviewer)",
        "public-reviewer": "var(--role-public-reviewer)",
        foreperson: "var(--role-foreperson)",
        writer: "var(--role-writer)",
      },

      // 关系（连线 / 状态标签）
      relation: {
        agree: "var(--relation-agree)",
        partial: "var(--relation-partial)",
        disagree: "var(--relation-disagree)",
      },

      // 流程状态
      status: {
        pending: "var(--status-pending)",
        running: "var(--status-running)",
        done: "var(--status-done)",
        error: "var(--status-error)",
      },
    },

    extend: {
      // —— 间距（4px 基数）——
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        12: "var(--space-12)",
      },

      // —— 圆角（不要用 8px 以上的圆角）——
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },

      // —— 字体 ——
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
        label: ["var(--font-label)"],
        // 让裸用的 font-sans / font-serif / font-mono 也落在设计系统内
        sans: ["var(--font-body)"],
        serif: ["var(--font-display)"],
      },

      // —— 字号：每一档都内置 1.7 行高，强制统一中文行高 ——
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-base)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-base)" }],
        base: ["var(--text-base)", { lineHeight: "var(--leading-base)" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--leading-base)" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--leading-base)" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-base)" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-base)" }],
      },

      // —— 行高令牌 ——
      lineHeight: {
        base: "var(--leading-base)",
      },

      // —— 阴影：仅保留唯一允许的一档，供组件手动引用（shadow-panel）——
      boxShadow: {
        panel: "var(--shadow-panel)",
      },

      // —— StatusDot 呼吸动画（备用，组件默认走 global.css 的 .status-dot-pulse）——
      keyframes: {
        "status-dot-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "status-dot-pulse": "status-dot-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [typography],
} satisfies Config;

export default config;
