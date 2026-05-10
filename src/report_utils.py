def render_markdown_report(state: dict) -> str:
    report = state.get("final_report", {})
    foreperson = state.get("foreperson_summary", {})

    lines = [
        f"# 案件分析报告：{state.get('case_id', '')}",
        "",
        f"**模式**: {report.get('mode_hint', '')}",
        "",
        "## 案件摘要",
        report.get("case_summary", ""),
        "",
        "## 核心争点",
    ]
    lines.extend(format_list(report.get("core_issues", [])))

    lines.extend(["", "## 公诉方观点"])
    lines.extend(format_list(report.get("prosecutor_view", [])))

    lines.extend(["", "## 辩护方观点"])
    lines.extend(format_list(report.get("defense_view", [])))

    lines.extend(["", "## 法官归纳"])
    lines.extend(format_list(report.get("judge_summary", [])))

    final_issue_status = (
        state.get("deliberation_room", {})
        .get("final_meeting_result", {})
        .get("final_issue_status", [])
    )
    lines.extend(["", "## Deliberation Room：争点证明状态总表"])
    lines.extend(format_final_issue_status(final_issue_status))

    lines.extend(["", "## 多视角评议结果"])
    reviewer = report.get("reviewer_summary", {})
    lines.append(f"- 多数意见: {reviewer.get('majority_view', '')}")
    lines.append(f"- 少数意见: {reviewer.get('minority_view', '无')}")

    if foreperson.get("consensus_points"):
        lines.extend(["", "### 共识点"])
        lines.extend(format_list(foreperson.get("consensus_points", [])))

    if foreperson.get("disagreement_points"):
        lines.extend(["", "### 分歧点"])
        lines.extend(format_list(foreperson.get("disagreement_points", [])))

    lines.extend(["", "## 证据缺口"])
    lines.extend(format_list(report.get("evidence_gaps", [])))

    lines.extend(["", "## 待讨论问题"])
    lines.extend(format_list(report.get("open_questions", [])))

    if report.get("risk_flags"):
        lines.extend(["", "## 风险提示"])
        lines.extend(format_list(report.get("risk_flags", [])))

    if report.get("next_step_suggestions"):
        lines.extend(["", "## 下一步建议"])
        lines.extend(format_list(report.get("next_step_suggestions", [])))

    return "\n".join(lines).rstrip() + "\n"


def format_list(items: list) -> list:
    if not items:
        return ["- 无"]
    if isinstance(items, str):
        return [f"- {items}"]
    if isinstance(items, dict):
        lines = []
        for k, v in items.items():
            if isinstance(v, list):
                for item in v:
                    lines.append(f"- {item}")
            elif v:
                lines.append(f"- {v}")
        return lines or ["- 无"]

    lines = []
    for item in items:
        if isinstance(item, dict):
            lines.append(f"- {item.get('issue', item.get('claim', str(item)))}")
        else:
            lines.append(f"- {item}")
    return lines


def format_final_issue_status(items: list) -> list:
    if not items:
        return ["暂无争点证明状态更新。"]

    lines = [
        "| 争点 | 最终证明状态 | 理由 | 剩余缺口 |",
        "|---|---|---|---|"
    ]
    for item in items:
        lines.append(
            "| {issue} | {status} | {reason} | {gap} |".format(
                issue=escape_table_cell(item.get("issue", "")),
                status=escape_table_cell(item.get("final_status", "")),
                reason=escape_table_cell(item.get("supporting_reason", "")),
                gap=escape_table_cell(item.get("remaining_gap", ""))
            )
        )

    return lines


def escape_table_cell(value) -> str:
    text = str(value) if value is not None else ""
    return text.replace("\n", "<br>").replace("|", "\\|")
