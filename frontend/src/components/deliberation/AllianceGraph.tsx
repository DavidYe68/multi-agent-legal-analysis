import { useMemo } from "react";
import ReactFlow, {
  Handle,
  Position,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

import type { AllianceMap, DisagreementMap } from "../../types";
import {
  positionLabel,
  relationColor,
  relationDashed,
  relationLabel,
  reviewerColorVar,
  reviewerLabel,
  reviewerTint,
  REVIEWER_ORDER,
} from "./reviewerMeta";

/**
 * AllianceGraph · 联盟与分歧图
 *
 * 四席评议者的关系图，用 React Flow 绘制。节点为自定义样式（角色色 0.1 底 + 1px 角色边框），
 * 不可拖拽、无 minimap / controls / 网格背景。
 *
 * 边由 deliberation_room.alliance_map 与 disagreement_map 共同推导，每对评议者一条：
 *   - alliance_map 给出骨架：allies → 同意(绿)，opponents → 反对(暗红)；
 *   - disagreement_map 叠加 partially_agree(琥珀虚线) 并补充 issue_id 标签。
 */

interface AllianceGraphProps {
  allianceMap: AllianceMap;
  disagreementMap: DisagreementMap;
  /** agent_id → 最终立场（节点副标题）。 */
  finalPositions: Record<string, string>;
}

interface ReviewerNodeData {
  agentId: string;
  position: string;
}

/** 自定义节点：角色色 0.1 透明底 + 角色色 1px 边框，140×60。 */
function ReviewerNode({ data }: NodeProps<ReviewerNodeData>) {
  const color = reviewerColorVar(data.agentId);
  return (
    <div
      className="flex flex-col items-center justify-center rounded"
      style={{
        width: 140,
        height: 60,
        border: `1px solid ${color}`,
        backgroundColor: reviewerTint(data.agentId, 10),
      }}
    >
      {/* 居中的隐藏连接点（id 区分 source/target）：使直线从节点中心相连，
          重叠段被上层节点遮挡，呈边到边观感。 */}
      <Handle
        id="t"
        type="target"
        position={Position.Top}
        style={{
          opacity: 0,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
      <Handle
        id="s"
        type="source"
        position={Position.Bottom}
        style={{
          opacity: 0,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
      <span className="font-body text-sm font-medium text-ink">
        {reviewerLabel(data.agentId)}
      </span>
      <span className="font-label text-xs" style={{ color }}>
        {positionLabel(data.position)}
      </span>
    </div>
  );
}

const nodeTypes = { reviewer: ReviewerNode };

/** 菱形坐标：上(法律) / 左(公众) / 右(专家) / 下(社会)。 */
const NODE_XY: Record<string, { x: number; y: number }> = {
  legal_reviewer: { x: 170, y: 0 },
  public_reviewer: { x: 0, y: 110 },
  expert_reviewer: { x: 340, y: 110 },
  social_reviewer: { x: 170, y: 220 },
};

interface PairEdge {
  a: string;
  b: string;
  relation: string;
  issue?: string;
}

/** 由 alliance_map + disagreement_map 推导每对评议者的关系（去重为一条边）。 */
function buildPairEdges(
  alliance: AllianceMap,
  disagreement: DisagreementMap,
): PairEdge[] {
  const pairs = new Map<string, PairEdge>();
  const keyOf = (a: string, b: string) => [a, b].sort().join("__");

  // 1) alliance 骨架：allies → agree
  for (const [a, entry] of Object.entries(alliance)) {
    for (const ally of entry.allies ?? []) {
      const k = keyOf(a, ally);
      if (!pairs.has(k)) pairs.set(k, { a, b: ally, relation: "agree" });
    }
  }
  // 2) alliance 骨架：opponents → disagree（不覆盖已存在的 agree）
  for (const [a, entry] of Object.entries(alliance)) {
    for (const opp of entry.opponents ?? []) {
      const k = keyOf(a, opp);
      if (!pairs.has(k)) pairs.set(k, { a, b: opp, relation: "disagree" });
    }
  }
  // 3) disagreement_map：补 partially_agree，并附 issue_id
  for (const e of disagreement) {
    const k = keyOf(e.agent_id, e.target_agent);
    const ex = pairs.get(k);
    if (!ex) {
      pairs.set(k, {
        a: e.agent_id,
        b: e.target_agent,
        relation: e.relation,
        issue: e.issue_id,
      });
    } else {
      if (e.relation === "partially_agree") ex.relation = "partially_agree";
      if (!ex.issue) ex.issue = e.issue_id;
    }
  }
  return [...pairs.values()];
}

export default function AllianceGraph({
  allianceMap,
  disagreementMap,
  finalPositions,
}: AllianceGraphProps) {
  const nodes = useMemo<Node<ReviewerNodeData>[]>(() => {
    return REVIEWER_ORDER.map((id) => ({
      id,
      type: "reviewer",
      position: NODE_XY[id] ?? { x: 0, y: 0 },
      data: { agentId: id, position: finalPositions[id] ?? "unclear" },
      // 预置尺寸：避免 React 18 StrictMode 下 React Flow 测量时序错位导致节点
      // 停留在 visibility:hidden（连带 fitView 与边不渲染）。
      width: 140,
      height: 60,
      style: { width: 140, height: 60 },
      draggable: false,
      selectable: false,
    }));
  }, [finalPositions]);

  const edges = useMemo<Edge[]>(() => {
    return buildPairEdges(allianceMap, disagreementMap).map((p, i) => {
      const color = relationColor(p.relation);
      return {
        id: `e-${p.a}-${p.b}-${i}`,
        source: p.a,
        target: p.b,
        sourceHandle: "s",
        targetHandle: "t",
        type: "straight",
        label: p.issue
          ? `${relationLabel(p.relation)} · ${p.issue}`
          : relationLabel(p.relation),
        style: {
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: relationDashed(p.relation) ? "6 4" : undefined,
        },
        labelStyle: {
          fill: "var(--text-secondary)",
          fontSize: 11,
          fontFamily: "var(--font-label)",
        },
        labelBgStyle: { fill: "var(--bg-surface)" },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 2,
      };
    });
  }, [allianceMap, disagreementMap]);

  const hasData = Object.keys(allianceMap).length > 0 || disagreementMap.length > 0;

  if (!hasData) {
    return (
      <p className="font-body text-sm text-ink-caption">
        本案未启用第二轮回应，暂无联盟 / 分歧关系。
      </p>
    );
  }

  return (
    <div>
      <div
        className="rounded border bg-surface"
        style={{ borderColor: "var(--border-default)", height: 300 }}
      >
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            edgesUpdatable={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          />
        </ReactFlowProvider>
      </div>

      {/* 图例 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1.5">
        <LegendItem relation="agree" desc="同意 / 联盟" />
        <LegendItem relation="partially_agree" desc="部分同意" />
        <LegendItem relation="disagree" desc="反对 / 分歧" />
      </div>
    </div>
  );
}

function LegendItem({ relation, desc }: { relation: string; desc: string }) {
  const color = relationColor(relation);
  const dashed = relationDashed(relation);
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="8" aria-hidden="true">
        <line
          x1="0"
          y1="4"
          x2="28"
          y2="4"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={dashed ? "6 4" : undefined}
        />
      </svg>
      <span className="font-label text-xs text-ink-secondary">{desc}</span>
    </span>
  );
}
