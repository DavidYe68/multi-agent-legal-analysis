import json
from src.llm_client import call_llm
from src.state_manager import create_state
from src.modes import modes_for_case, build_reports_for_modes

ALLOWED_STATUS = {"open", "partly_closed", "closed"}


def _call_for_mode(prompt, state, mode):
    payload = {
        "case_narrative": state["case_narrative"],
        "facts": state["facts"],
        "claims": state["claims"],
        "evidence": state["evidence"],
        "procedure": state["procedure"],
        "domain": state["domain"],
        "task_mode": mode,
    }
    return call_llm(prompt, json.dumps(payload, ensure_ascii=False))


def _aggregate_usage(usages):
    if len(usages) == 1:
        return usages[0]
    agg = {
        "model": usages[0].get("model"),
        "temperature": usages[0].get("temperature"),
        "num_calls": len(usages),
        "calls": usages,
    }
    for key in ("prompt_tokens", "completion_tokens", "total_tokens",
                "cache_hit_tokens", "cache_miss_tokens", "estimated_cost"):
        agg[key] = round(sum(u.get(key, 0) for u in usages), 6)
    return agg


def _reader_evidence_gaps(output):
    # 面向读者的缺口文本优先用 evidence_gaps_text；为空则回退到结构化 evidence_gaps，
    # 避免模型只填了结构化缺口时 practice 报告显示“无缺口”。
    reader_gaps = [text for text in output.get("evidence_gaps_text", []) if text]
    if reader_gaps:
        return reader_gaps
    return [item.get("gap", "") for item in output.get("evidence_gaps", []) if item.get("gap")]


def _build_report(output, mode):
    # 面向读者的报告对象，供主评测的安全性检查与 practice 评测读取
    return {
        "mode_hint": mode,
        "case_summary": output.get("case_summary", ""),
        "core_issues": output.get("core_issues", []),
        "prosecutor_view": output.get("prosecutor_view", []),
        "defense_view": output.get("defense_view", []),
        "judge_summary": output.get("judge_summary", []),
        "reviewer_summary": output.get("reviewer_summary", {}),
        "evidence_gaps": _reader_evidence_gaps(output),
        "open_questions": output.get("open_questions", []),
        "risk_flags": output.get("risk_flags", []),
        "next_step_suggestions": output.get("next_step_suggestions", []),
    }


def run_baseline(case_data, config):
    state = create_state(case_data, config)

    with open("prompts/baseline.txt", "r", encoding="utf-8") as f:
        prompt = f.read()

    default_mode = state.get("task_mode", "teaching")
    # 与多 Agent 系统的 Writer 一致：practice 验证案件同时出 teaching/practice 两份报告
    modes = modes_for_case(state.get("case_id"), default_mode)

    outputs = {}
    usages = {}

    def produce_report(mode):
        print(f"开始调用Baseline LLM（{mode}）")
        output, usage = _call_for_mode(prompt, state, mode)
        outputs[mode] = output
        usages[mode] = usage
        return _build_report(output, mode)

    final_reports, default_report = build_reports_for_modes(modes, default_mode, produce_report)
    print("完成")

    output = outputs[default_mode]
    usage_list = [usages[mode] for mode in modes if mode in usages]

    issues = output.get("issues", [])
    evidence_issue_map = output.get("evidence_issue_map", [])
    structured_gaps = output.get("evidence_gaps", [])

    issue_text_map = {item.get("issue_id"): item.get("issue_text", "") for item in issues}
    gap_map = {
        item.get("issue_id"): item.get("gap", "")
        for item in structured_gaps if item.get("issue_id")
    }

    final_issue_status = []
    for item in output.get("final_issue_status", []):
        issue_id = item.get("issue_id")
        status = item.get("final_status")
        status = status if status in ALLOWED_STATUS else "open"
        issue_text = issue_text_map.get(issue_id, "")
        # 与 pipeline.build_final_issue_status 同构，保证报告渲染与 baseline/多 Agent 对比口径一致
        final_issue_status.append({
            "issue_id": issue_id,
            "issue": issue_text,
            "issue_text": issue_text,
            "final_status": status,
            "supporting_reason": item.get("reason", ""),
            "remaining_gap": gap_map.get(issue_id, ""),
        })

    # 把单次调用的结构化输出散布到评测脚本读取的同名 state 字段，
    # 保证 baseline 与多 Agent 系统采用完全相同的输出契约（仅机制不同）。
    state["issues"] = {
        "issues": issues,
        "main_issues": [item.get("issue_text", "") for item in issues],
    }
    state["prosecutor_analysis"] = {
        "evidence_issue_map": evidence_issue_map,
    }
    state["judge_summary"] = {
        "evidence_gaps": structured_gaps,
    }
    state["deliberation_room"] = {
        "final_meeting_result": {
            "final_issue_status": final_issue_status,
        }
    }

    state["final_reports"] = final_reports
    state["final_report"] = default_report
    state["baseline_usage"] = _aggregate_usage(usage_list)
    return state
