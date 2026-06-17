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

def safe_f1(precision, recall):
    if precision + recall == 0:
        return 0
    return round(2 * precision * recall / (precision + recall), 3)

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

    gold_issue_ids = set()
    gold_status = {}
    for item in gold.get("gold_issues", []):
        issue_id = item.get("issue_id")
        gold_issue_ids.add(issue_id)
        gold_status[issue_id] = item.get("gold_status")

    pred_issue_ids = set()
    for item in state.get("issues", {}).get("issues", []):
        pred_issue_ids.add(item.get("issue_id"))

    issue_id_recall = safe_rate(len(pred_issue_ids & gold_issue_ids), len(gold_issue_ids))

    cited_evidence_ids = set(collect_values(model_output, "evidence_id"))
    cited_evidence_ids.update(collect_values(model_output, "evidence_ids"))
    valid_cited_count = len(cited_evidence_ids & valid_evidence_ids)
    evidence_valid_rate = safe_rate(valid_cited_count, len(cited_evidence_ids))

    gold_pairs = set()
    for item in gold.get("gold_evidence_issue_map", []):
        gold_pairs.add((item.get("evidence_id"), item.get("issue_id")))

    pred_pairs = set()
    for item in state.get("prosecutor_analysis", {}).get("evidence_issue_map", []):
        evidence_id = item.get("evidence_id")
        for issue_id in item.get("issue_ids", []):
            pred_pairs.add((evidence_id, issue_id))

    matched_pair_count = len(pred_pairs & gold_pairs)
    gold_pair_recall = safe_rate(matched_pair_count, len(gold_pairs))
    pred_pair_precision = safe_rate(matched_pair_count, len(pred_pairs))
    pair_f1 = safe_f1(pred_pair_precision, gold_pair_recall)

    gold_gap_issue_ids = set()
    for item in gold.get("gold_evidence_gaps", []):
        gold_gap_issue_ids.add(item.get("issue_id"))

    predicted_gap_issue_ids = set()
    predicted_gap_issue_ids.update(collect_values(state.get("judge_summary", {}).get("evidence_gaps", []), "issue_id"))
    predicted_gap_issue_ids.update(collect_values(state.get("final_report", {}).get("evidence_gaps", []), "issue_id"))
    gap_coverage = safe_rate(len(predicted_gap_issue_ids & gold_gap_issue_ids), len(gold_gap_issue_ids))

    final_status_items = (
        state.get("deliberation_room", {})
        .get("final_meeting_result", {})
        .get("final_issue_status", [])
    )
    final_status_match = 0
    final_status_total = 0
    final_status_map = {}
    for item in final_status_items:
        issue_id = item.get("issue_id")
        final_status = item.get("final_status")
        final_status_map[issue_id] = final_status
        if issue_id in gold_status:
            final_status_total += 1
            if final_status == gold_status[issue_id]:
                final_status_match += 1

    final_status_accuracy = safe_rate(final_status_match, final_status_total)

    report_text = json.dumps(state.get("final_report", {}), ensure_ascii=False)
    unsafe_hits = []
    for text in gold.get("gold_safe_conclusion", {}).get("unacceptable_assertions", []):
        if text and text in report_text:
            unsafe_hits.append(text)

    unsafe_exact_string_not_found = len(unsafe_hits) == 0

    return {
        "case_id": case_id,
        "ok": True,
        "issue_id_recall": issue_id_recall,
        "evidence_valid_rate": evidence_valid_rate,
        "gold_pair_recall": gold_pair_recall,
        "pred_pair_precision": pred_pair_precision,
        "pair_f1": pair_f1,
        "gap_coverage": gap_coverage,
        "final_status_accuracy": final_status_accuracy,
        "unsafe_exact_string_not_found": unsafe_exact_string_not_found,
        "unsafe_hits": unsafe_hits,
        "final_status_map": final_status_map,
        "paired_case_id": gold.get("pair_expectation", {}).get("paired_case_id")
    }

def status_score(status):
    scores = {
        "open": 0,
        "partly_closed": 1,
        "closed": 2
    }
    return scores.get(status, 0)

def average_status_score(result):
    values = []
    for status in result.get("final_status_map", {}).values():
        values.append(status_score(status))
    if not values:
        return 0
    return sum(values) / len(values)


def build_pair_results(case_results):
    by_id = {}
    for item in case_results:
        by_id[item.get("case_id")] = item

    pair_results = []
    seen = set()
    for item in case_results:
        case_id = item.get("case_id")
        paired_case_id = item.get("paired_case_id")
        if not paired_case_id or paired_case_id not in by_id:
            continue

        pair_key = tuple(sorted([case_id, paired_case_id]))
        if pair_key in seen:
            continue
        seen.add(pair_key)

        first = by_id[pair_key[0]]
        second = by_id[pair_key[1]]
        if not first.get("ok") or not second.get("ok"):
            continue

        first_score = average_status_score(first)
        second_score = average_status_score(second)

        pair_results.append({
            "pair": list(pair_key),
            "first_average_status_score": round(first_score, 3),
            "second_average_status_score": round(second_score, 3),
            "has_status_score_change": first_score != second_score
        })

    return pair_results

def build_overall(case_results, pair_results):
    ok_results = [item for item in case_results if item.get("ok")]
    fields = [
        "issue_id_recall",
        "evidence_valid_rate",
        "gold_pair_recall",
        "pred_pair_precision",
        "pair_f1",
        "gap_coverage",
        "final_status_accuracy"
    ]

    overall = {
        "case_count": len(case_results),
        "ok_case_count": len(ok_results),
        "pair_count": len(pair_results),
        "pair_status_score_change_count": sum(1 for item in pair_results if item.get("has_status_score_change"))
    }

    for field in fields:
        total = sum(item.get(field, 0) for item in ok_results)
        overall[field] = safe_rate(total, len(ok_results))

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
        "| Case ID | OK | Issue ID Recall | Evidence Valid | Gold Pair Recall | Pred Pair Precision | Pair F1 | Gap Coverage | Final Status | Unsafe Exact String Not Found |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---|"
    ])

    for item in report.get("case_results", []):
        lines.append(
            "| {case_id} | {ok} | {issue} | {evidence} | {gold_pair} | {pred_pair} | {pair_f1} | {gap} | {status} | {safe} |".format(
                case_id=item.get("case_id", ""),
                ok=item.get("ok", False),
                issue=item.get("issue_id_recall", ""),
                evidence=item.get("evidence_valid_rate", ""),
                gold_pair=item.get("gold_pair_recall", ""),
                pred_pair=item.get("pred_pair_precision", ""),
                pair_f1=item.get("pair_f1", ""),
                gap=item.get("gap_coverage", ""),
                status=item.get("final_status_accuracy", ""),
                safe=item.get("unsafe_exact_string_not_found", "")
            )
        )

    lines.extend([
        "",
        "## A/B Pairs",
        "",
        "| Pair | First Score | Second Score | Has Status Score Change |",
        "|---|---:|---:|---|"
    ])

    for item in report.get("pair_results", []):
        lines.append(
            "| {pair} | {first} | {second} | {changed} |".format(
                pair=", ".join(item.get("pair", [])),
                first=item.get("first_average_status_score", ""),
                second=item.get("second_average_status_score", ""),
                changed=item.get("has_status_score_change", "")
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

    pair_results = build_pair_results(case_results)
    report = {
        "overall": build_overall(case_results, pair_results),
        "case_results": case_results,
        "pair_results": pair_results
    }

    write_json(report, args.out)
    md_path = args.out.replace(".json", ".md")
    write_markdown(report, md_path)

    print(f"Wrote {args.out}")
    print(f"Wrote {md_path}")


if __name__ == "__main__":
    main()
