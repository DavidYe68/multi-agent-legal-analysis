import argparse
import json
import os
import re

PRACTICE_GOLD_DIR = "datasets/practice_gold"


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(data, path):
    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def safe_rate(numerator, denominator):
    if denominator == 0:
        return 0
    return round(numerator / denominator, 3)


def flatten_text(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(flatten_text(v) for v in value.values())
    if isinstance(value, list):
        return " ".join(flatten_text(v) for v in value)
    return str(value)


def as_text_list(value):
    if not value:
        return []
    if isinstance(value, list):
        return [flatten_text(item).strip() for item in value if flatten_text(item).strip()]
    text = flatten_text(value).strip()
    return [text] if text else []


def char_bigrams(text):
    compact = re.sub(r"\s+", "", text)
    if len(compact) < 2:
        return set()
    return {compact[i:i + 2] for i in range(len(compact) - 1)}


def similarity(expected, actual):
    expected_grams = char_bigrams(expected)
    if not expected_grams:
        return 0
    actual_grams = char_bigrams(actual)
    return len(expected_grams & actual_grams) / len(expected_grams)


def text_matches(expected, candidates, threshold=0.35):
    for candidate in candidates:
        if expected and expected in candidate:
            return True
        if similarity(expected, candidate) >= threshold:
            return True
    return False


def risk_matches(expected_risk, risk_flags):
    category = expected_risk.get("category", "")
    description = expected_risk.get("description", "")
    if text_matches(category, risk_flags, threshold=0.45):
        return True
    return text_matches(description, risk_flags, threshold=0.28)


def step_matches(expected_step, suggestions):
    action = expected_step.get("action", "")
    return text_matches(action, suggestions, threshold=0.28)


def collect_gold_files():
    files = []
    if not os.path.isdir(PRACTICE_GOLD_DIR):
        return files
    for filename in sorted(os.listdir(PRACTICE_GOLD_DIR)):
        if filename.endswith("_practice_gold.json"):
            files.append(os.path.join(PRACTICE_GOLD_DIR, filename))
    return files


def get_practice_report(state):
    reports = state.get("final_reports")
    if isinstance(reports, dict) and isinstance(reports.get("practice"), dict):
        return reports["practice"]

    report = state.get("final_report")
    if isinstance(report, dict) and report.get("mode_hint") == "practice":
        return report
    return {}


def evaluate_case(gold_path, outputs_dir):
    gold = read_json(gold_path)
    case_id = gold.get("case_id", "")
    state_path = f"{outputs_dir}/{case_id}/state_final.json"

    if not os.path.exists(state_path):
        return {
            "case_id": case_id,
            "ok": False,
            "error": f"缺少输出文件: {state_path}"
        }

    state = read_json(state_path)
    report = get_practice_report(state)
    if not report:
        return {
            "case_id": case_id,
            "ok": False,
            "error": "state 中缺少 practice Writer 报告"
        }

    risk_flags = as_text_list(report.get("risk_flags"))
    suggestions = as_text_list(report.get("next_step_suggestions"))
    report_text = flatten_text(report)

    expected_risks = gold.get("expected_risk_flags", [])
    matched_risks = []
    missed_risks = []
    for risk in expected_risks:
        if risk_matches(risk, risk_flags):
            matched_risks.append(risk.get("risk_id", ""))
        else:
            missed_risks.append({
                "risk_id": risk.get("risk_id", ""),
                "category": risk.get("category", ""),
                "severity": risk.get("severity", "")
            })

    high_risks = [r for r in expected_risks if r.get("severity") in ("critical", "major")]
    matched_high_risks = [r for r in high_risks if risk_matches(r, risk_flags)]

    expected_steps = gold.get("expected_next_steps", [])
    matched_steps = []
    missed_steps = []
    for step in expected_steps:
        if step_matches(step, suggestions):
            matched_steps.append(step.get("step_id", ""))
        else:
            missed_steps.append({
                "step_id": step.get("step_id", ""),
                "priority": step.get("priority", ""),
                "action": step.get("action", "")
            })

    overclaim_hits = []
    for claim in gold.get("must_not_claim", []):
        if claim and claim in report_text:
            overclaim_hits.append(claim)

    boundary_hits = []
    for boundary in gold.get("conclusion_boundaries", []):
        if text_matches(boundary, [report_text], threshold=0.3):
            boundary_hits.append(boundary)

    return {
        "case_id": case_id,
        "ok": True,
        "risk_category_coverage": safe_rate(len(matched_risks), len(expected_risks)),
        "high_priority_risk_coverage": safe_rate(len(matched_high_risks), len(high_risks)),
        "next_step_suggestion_coverage": safe_rate(len(matched_steps), len(expected_steps)),
        "overclaim_hit_count": len(overclaim_hits),
        "risk_flags_nonempty": len(risk_flags) > 0,
        "next_step_suggestions_nonempty": len(suggestions) > 0,
        "risk_flag_count": len(risk_flags),
        "next_step_suggestion_count": len(suggestions),
        "matched_risk_ids": matched_risks,
        "missed_risks": missed_risks,
        "matched_step_ids": matched_steps,
        "missed_steps": missed_steps,
        "overclaim_hits": overclaim_hits,
        "conclusion_boundary_hit_count": len(boundary_hits),
        "manual_review_checklist": [
            "核对每条风险是否能追溯到已有争点、证据、Judge未决事项或证据缺口。",
            "核对高优先级风险是否覆盖关键证明风险，且没有被弱化为课堂讨论问题。",
            "核对下一步建议是否是可执行动作，而不是泛泛复述。",
            "核对报告是否保留结论边界，没有把open争点写成确定结论。",
            "自动评估只做关键词/子串式结构检查，最终仍需人工法律语义复核。"
        ]
    }


def build_overall(case_results):
    ok_results = [item for item in case_results if item.get("ok")]
    overall = {
        "case_count": len(case_results),
        "ok_case_count": len(ok_results),
        "failed_case_count": len(case_results) - len(ok_results)
    }

    for key in [
        "risk_category_coverage",
        "high_priority_risk_coverage",
        "next_step_suggestion_coverage"
    ]:
        total = sum(item.get(key, 0) for item in ok_results)
        overall[key] = safe_rate(total, len(ok_results))

    overall["overclaim_hit_count"] = sum(item.get("overclaim_hit_count", 0) for item in ok_results)
    overall["risk_flags_nonempty_rate"] = safe_rate(
        sum(1 for item in ok_results if item.get("risk_flags_nonempty")),
        len(ok_results)
    )
    overall["next_step_suggestions_nonempty_rate"] = safe_rate(
        sum(1 for item in ok_results if item.get("next_step_suggestions_nonempty")),
        len(ok_results)
    )
    return overall


def write_markdown(report, path):
    lines = [
        "# Practice Mode Evaluation Results",
        "",
        "> 本报告是结构性自动评估，只做关键词/子串式检查；最终仍需人工法律语义复核。",
        "",
        "## Overall",
        "",
        "| Metric | Value |",
        "|---|---:|"
    ]

    for key, value in report.get("overall", {}).items():
        lines.append(f"| {key} | {value} |")

    lines.extend([
        "",
        "## Cases",
        "",
        "| Case ID | OK | Risk Coverage | High Priority Risk Coverage | Next Step Coverage | Overclaim Hits | Risk Flags | Next Steps |",
        "|---|---|---:|---:|---:|---:|---:|---:|"
    ])

    for item in report.get("case_results", []):
        lines.append(
            "| {case_id} | {ok} | {risk} | {high} | {step} | {hits} | {risk_count} | {step_count} |".format(
                case_id=item.get("case_id", ""),
                ok=item.get("ok", False),
                risk=item.get("risk_category_coverage", ""),
                high=item.get("high_priority_risk_coverage", ""),
                step=item.get("next_step_suggestion_coverage", ""),
                hits=item.get("overclaim_hit_count", ""),
                risk_count=item.get("risk_flag_count", ""),
                step_count=item.get("next_step_suggestion_count", "")
            )
        )

    lines.extend(["", "## Manual Review Checklist", ""])
    for item in report.get("case_results", []):
        lines.append(f"### {item.get('case_id', '')}")
        if not item.get("ok"):
            lines.append(f"- 运行状态：{item.get('error', '')}")
            lines.append("")
            continue
        for check in item.get("manual_review_checklist", []):
            lines.append(f"- {check}")
        if item.get("missed_risks"):
            lines.append(f"- 自动检查未覆盖风险：{json.dumps(item['missed_risks'], ensure_ascii=False)}")
        if item.get("missed_steps"):
            lines.append(f"- 自动检查未覆盖建议：{json.dumps(item['missed_steps'], ensure_ascii=False)}")
        lines.append("")

    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exp", default="full")
    parser.add_argument("--outputs-dir", default="")
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    outputs_dir = args.outputs_dir or f"outputs/{args.exp}"
    out_json = args.out or f"{outputs_dir}/practice_evaluation_results.json"
    out_md = out_json.replace(".json", ".md")

    case_results = []
    for gold_path in collect_gold_files():
        case_results.append(evaluate_case(gold_path, outputs_dir))

    report = {
        "evaluation_type": "practice_mode_structural_keyword_check",
        "outputs_dir": outputs_dir,
        "gold_dir": PRACTICE_GOLD_DIR,
        "overall": build_overall(case_results),
        "case_results": case_results,
        "note": "自动评估只做关键词/子串式结构检查，最终仍需人工法律语义复核。"
    }

    write_json(report, out_json)
    write_markdown(report, out_md)
    print(f"JSON: {out_json}")
    print(f"报告: {out_md}")


if __name__ == "__main__":
    main()
