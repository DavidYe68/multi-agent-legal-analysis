def render_markdown_report(state: dict) -> str:
    report = state.get("final_report", {})
    deliberation = state.get("deliberation_room", {})
    vote = deliberation.get("vote_history", [{}])[-1] if deliberation.get("vote_history") else {}
    chair = deliberation.get("final_meeting_result", {})

    lines = [
        f"# ICAD Criminal Report: {state.get('case_id', '')}",
        "",
        f"- Mode: {state.get('user_mode', '')}",
        f"- Majority position: {vote.get('majority_position', 'unclear')}",
        "",
        "## Case Summary",
        report.get("case_summary", ""),
        "",
        "## Core Issues",
    ]

    lines.extend(format_list(report.get("core_issues", [])))

    lines.extend([
        "",
        "## Prosecution View",
    ])
    lines.extend(format_arguments(state.get("prosecutor_analysis", {}).get("arguments_by_issue", [])))

    lines.extend([
        "",
        "## Defense View",
    ])
    lines.extend(format_arguments(state.get("defense_analysis", {}).get("arguments_by_issue", [])))

    lines.extend([
        "",
        "## Judge Summary",
    ])
    lines.extend(format_list(state.get("judge_summary", {}).get("judge_observations", [])))

    lines.extend([
        "",
        "## Evidence Gaps",
    ])
    lines.extend(format_evidence_gaps(report.get("evidence_gaps", [])))

    lines.extend([
        "",
        "## Deliberation Result",
        f"- Majority view: {chair.get('majority_view', '')}",
        f"- Minority view: {chair.get('minority_view', '')}",
        f"- Final result type: {chair.get('final_result_type', '')}",
        "",
        "### Vote Count",
    ])
    lines.extend(format_vote_count(vote.get("vote_count", {})))

    lines.extend([
        "",
        "## Discussion Questions",
    ])
    lines.extend(format_list(report.get("discussion_questions", [])))

    return "\n".join(lines).rstrip() + "\n"


def format_list(items: list) -> list:
    if not items:
        return ["- None"]
    return [f"- {item}" for item in items]


def format_arguments(arguments: list) -> list:
    if not arguments:
        return ["- None"]

    lines = []
    for item in arguments:
        lines.append(f"- Issue: {item.get('issue', '')}")
        if item.get("claim"):
            lines.append(f"  Claim: {item.get('claim', '')}")
        if item.get("reasoning"):
            lines.append(f"  Reasoning: {item.get('reasoning', '')}")
    return lines


def format_evidence_gaps(gaps: list) -> list:
    if not gaps:
        return ["- None"]

    lines = []
    for gap in gaps:
        if isinstance(gap, dict):
            lines.append(f"- {gap.get('issue', '证据缺口')}: {gap.get('gap', '')}")
            if gap.get("impact_on_conviction"):
                lines.append(f"  Impact: {gap.get('impact_on_conviction', '')}")
        else:
            lines.append(f"- {gap}")
    return lines


def format_vote_count(vote_count: dict) -> list:
    if not vote_count:
        return ["- None"]

    return [
        f"- {position}: {count}"
        for position, count in vote_count.items()
    ]
