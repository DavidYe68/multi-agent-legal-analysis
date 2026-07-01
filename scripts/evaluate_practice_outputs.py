import argparse
import json
import os

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

    overclaim_hits = []
    for claim in gold.get("must_not_claim", []):
        if claim and claim in report_text:
            overclaim_hits.append(claim)

    return {
        "case_id": case_id,
        "ok": True,
        "overclaim_hit_count": len(overclaim_hits),
        "overclaim_hits": overclaim_hits,
        "risk_flags_nonempty": len(risk_flags) > 0,
        "next_step_suggestions_nonempty": len(suggestions) > 0,
        "risk_flag_count": len(risk_flags),
        "next_step_suggestion_count": len(suggestions)
    }


def build_overall(case_results):
    ok_results = [item for item in case_results if item.get("ok")]
    overall = {
        "case_count": len(case_results),
        "ok_case_count": len(ok_results),
        "failed_case_count": len(case_results) - len(ok_results)
    }

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
        "# Practice Mode Checks",
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
        "| Case ID | OK | Overclaim Hits | Risk Flags | Next Steps |",
        "|---|---|---:|---:|---:|"
    ])

    for item in report.get("case_results", []):
        lines.append(
            "| {case_id} | {ok} | {hits} | {risk_count} | {step_count} |".format(
                case_id=item.get("case_id", ""),
                ok=item.get("ok", False),
                hits=item.get("overclaim_hit_count", ""),
                risk_count=item.get("risk_flag_count", ""),
                step_count=item.get("next_step_suggestion_count", "")
            )
        )

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
        "outputs_dir": outputs_dir,
        "gold_dir": PRACTICE_GOLD_DIR,
        "overall": build_overall(case_results),
        "case_results": case_results
    }

    write_json(report, out_json)
    write_markdown(report, out_md)
    print(f"JSON: {out_json}")
    print(f"报告: {out_md}")


if __name__ == "__main__":
    main()
