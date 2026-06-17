# 多智能体法律协商系统 · 前端

Vite + React + TypeScript。争点中心的对抗—协商式法律推理系统的可视化前端。

## 快速开始

```bash
cd frontend
npm install && npm run dev          # 安装依赖并启动开发服务器
```

数据准备（首次运行或数据更新后执行，从项目根拷贝案件与产物到 `public/data/`）：

```bash
bash scripts/copy-data.sh           # 等价于 npm run copy-data
```

## 脚本

- `npm run dev` — 启动开发服务器
- `npm run build` — 类型检查 + 生产构建
- `npm run preview` — 预览生产构建
- `npm run copy-data` — 运行 `scripts/copy-data.sh`，把案件与运行产物拷到 `public/data/`

## 数据

`scripts/copy-data.sh` 生成：

- `public/data/cases/{caseId}.json` ← `datasets/cases/processed/{caseId}.json`
- `public/data/outputs/{caseId}.json` ← `outputs/{caseId}/state_final.json`
- `public/data/manifest.json` — 案件与产物的 id 清单（浏览器无法列目录，需要它）

数据服务层在 `src/services/caseService.ts`，类型定义在 `src/types/index.ts`。

## 页面清单

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | HomePage · 案件选择 | 案件网格，按模式/类型/变体/数据集筛选 |
| `/case/:caseId` | CourtroomPage · 庭审主工作台 | 流水线状态条 + 卷宗栏 + 争点对抗区 + 评议室 |
| `/case/:caseId/report` | ReportPage · 最终报告 | 教学/实务两种视图，可导出 Markdown / JSON |
| `/compare/:pairId` | ComparePage · A/B 对照 | 同一最小对照组两案左右并排：不变事实、改变变量、推理变化 |
| `/dataset` | DatasetPage · 数据集概览 | 统计数字、数据处理流程图、案件类型分布条形图 |

> `pairId` 形如 `criminal_001`，对应 `criminal_001a` / `criminal_001b`。

## 演示模式

顶栏右上角「演示模式」按钮（服务答辩）：进入全屏、整体放大 10%、隐藏顶栏开发信息、
自动跳到第一个已运行的案例；退出全屏（含按 ESC）时自动关闭。

## 设计系统

设计令牌在 `src/styles/tokens.css`（唯一真源），全局样式在 `src/styles/global.css`，
Tailwind 配置 `tailwind.config.ts` 全部引用这些 CSS 变量。组件一律用 CSS 变量取色，
不硬编码十六进制（唯一例外：`DatasetPage` 用 `getComputedStyle` 把令牌解析成具体色值
交给 Recharts SVG，取值仍来自 tokens.css）。

## 已知限制

- **数据为静态快照**：前端只读 `public/data/` 下的本地 JSON，不连实时后端。
  案件/产物更新后需重跑 `bash scripts/copy-data.sh` 才会反映到页面。
- **依赖显式 manifest**：浏览器无法列目录，`listCases()` 依赖 `manifest.json` 的 id 清单。
- **A/B 对照的匹配口径**：事实按 `fact_id` 匹配（正文一致归为不变、不同归为改变变量）；
  争点状态按 `issue_id` 匹配，仅两案共有且状态不同的争点显示 `→` 高亮；评议者立场按
  四类固定角色匹配。跨案 `issue_id` 含义可能不同，对照仅供参考。
- **演示模式的放大用 `zoom`**：设计令牌为绝对 px，改 `html` font-size 不会生效，故用
  `zoom: 1.1` 实现等效整体放大；`zoom` 在 Chromium 内核浏览器支持最佳。
- **未运行的案例**：无 `state_final.json` 的案例，相关环节显示「该案例尚未运行」。
