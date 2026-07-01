import argparse
import json
import os

PROCESSED_DIR = "datasets/cases/processed"
GOLD_DIR = "datasets/cases/gold"
SPLIT_DIR = "datasets/splits"
DEFAULT_OUTPUTS_DIR = "outputs"

def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(data, path):
    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_case_ids(args):
    if args.case:
        return [args.case]

    if args.split:
        return read_json(f"{SPLIT_DIR}/{args.split}.json")

    case_ids = []
    for filename in sorted(os.listdir(PROCESSED_DIR)):
        if filename.endswith(".json"):
            case_ids.append(filename.replace(".json", ""))
    return case_ids

def collect_values(data, target_key):
    values = []
    if isinstance(data, dict):
        for key, value in data.items():
            if key == target_key and isinstance(value, str):
                values.append(value)
            elif key == target_key and isinstance(value, list):
                values.extend(value)
            else:
                values.extend(collect_values(value, target_key))
    elif isinstance(data, list):
        for item in data:
            values.extend(collect_values(item, target_key))
    return values

def output_part(state):
    keys = [
        "issues",
        "prosecutor_analysis",
        "defense_analysis",
        "judge_summary",
        "reviewer_outputs",
        "round2_outputs",
        "deliberation_room",
        "foreperson_summary",
        "final_report"
    ]
    result = {}
    for key in keys:
        result[key] = state.get(key, {})
    return result

def safe_rate(numerator, denominator):
    if denominator == 0:
        return 0
    return round(numerator / denominator, 3)

def evaluate_case(case_id, outputs_dir):
    state_path = f"{outputs_dir}/{case_id}/state_final.json"
    gold_path = f"{GOLD_DIR}/{case_id}_gold.json"
    processed_path = f"{PROCESSED_DIR}/{case_id}.json"

    if not os.path.exists(state_path):
        return {"case_id": case_id, "ok": False, "error": f"缺少输出文件: {state_path}"}
    if not os.path.exists(gold_path):
        return {"case_id": case_id, "ok": False, "error": f"缺少 gold 文件: {gold_path}"}

    state = read_json(state_path)
    gold = read_json(gold_path)
    processed = read_json(processed_path)
    model_output = output_part(state)

    valid_evidence_ids = set()
    for item in processed.get("evidence", []):
        valid_evidence_ids.add(item.get("evidence_id"))

    cited_evidence_ids = set(collect_values(model_output, "evidence_id"))
    cited_evidence_ids.update(collect_values(model_output, "evidence_ids"))
    cited_evidence_ids.update(collect_values(model_output, "related_evidence_ids"))
    valid_cited_count = len(cited_evidence_ids & valid_evidence_ids)
    evidence_valid_rate = safe_rate(valid_cited_count, len(cited_evidence_ids))

    report_text = json.dumps(state.get("final_report", {}), ensure_ascii=False)
    unsafe_hits = []
    for text in gold.get("gold_safe_conclusion", {}).get("unacceptable_assertions", []):
        if text and text in report_text:
            unsafe_hits.append(text)

    unsafe_exact_string_not_found = len(unsafe_hits) == 0

    return {
        "case_id": case_id,
        "ok": True,
        "evidence_valid_rate": evidence_valid_rate,
        "unsafe_exact_string_not_found": unsafe_exact_string_not_found,
        "unsafe_hits": unsafe_hits
    }

def build_overall(case_results):
    ok_results = [item for item in case_results if item.get("ok")]

    overall = {
        "case_count": len(case_results),
        "ok_case_count": len(ok_results),
    }

    total = sum(item.get("evidence_valid_rate", 0) for item in ok_results)
    overall["evidence_valid_rate"] = safe_rate(total, len(ok_results))

    if ok_results:
        safe_count = sum(1 for item in ok_results if item.get("unsafe_exact_string_not_found"))
        overall["unsafe_exact_string_not_found_rate"] = safe_rate(safe_count, len(ok_results))
    else:
        overall["unsafe_exact_string_not_found_rate"] = 0

    return overall

def write_markdown(report, path):
    lines = [
        "# Evaluation Results",
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
        "| Case ID | OK | Evidence Valid | Unsafe Exact String Not Found |",
        "|---|---|---:|---|"
    ])

    for item in report.get("case_results", []):
        lines.append(
            "| {case_id} | {ok} | {evidence} | {safe} |".format(
                case_id=item.get("case_id", ""),
                ok=item.get("ok", False),
                evidence=item.get("evidence_valid_rate", ""),
                safe=item.get("unsafe_exact_string_not_found", "")
            )
        )

    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", default="")
    parser.add_argument("--split", default="")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--outputs-dir", default=DEFAULT_OUTPUTS_DIR)
    parser.add_argument("--out", default="outputs/evaluation_results.json")
    args = parser.parse_args()

    case_ids = get_case_ids(args)
    case_results = []
    for case_id in case_ids:
        case_results.append(evaluate_case(case_id, args.outputs_dir))

    report = {
        "overall": build_overall(case_results),
        "case_results": case_results
    }

    write_json(report, args.out)
    md_path = args.out.replace(".json", ".md")
    write_markdown(report, md_path)

    print(f"Wrote {args.out}")
    print(f"Wrote {md_path}")


if __name__ == "__main__":
    main()
