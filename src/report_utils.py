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
    lines = []
    for item in items:
        if isinstance(item, dict):
            lines.append(f"- {item.get('issue', item.get('claim', str(item)))}")
        else:
            lines.append(f"- {item}")
    return lines