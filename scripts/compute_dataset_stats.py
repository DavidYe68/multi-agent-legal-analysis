import json
import os


CASE_DIR = "datasets/cases/processed"
GOLD_DIR = "datasets/cases/gold"
OUTPUT_DIR = "outputs"


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    case_stats = []

    for filename in sorted(os.listdir(CASE_DIR)):
        if not filename.endswith(".json"):
            continue

        case_path = f"{CASE_DIR}/{filename}"
        case_data = read_json(case_path)
        case_id = case_data["case_id"]
        gold_path = f"{GOLD_DIR}/{case_id}_gold.json"
        gold_data = read_json(gold_path)

        case_stats.append({
            "case_id": case_id,
            "case_type": case_data["domain"]["case_category"],
            "task_mode": case_data["task_mode"],
            "fact_count": len(case_data["facts"]),
            "claim_count": len(case_data["claims"]),
            "evidence_count": len(case_data["evidence"]),
            "gold_issue_count": len(gold_data["gold_issues"]),
            "gold_gap_count": len(gold_data["gold_evidence_gaps"]),
            "role_view_count": len(case_data["role_views"])
        })

    statistics = {
        "overall_statistics": build_overall_stats(case_stats),
        "case_level_statistics": case_stats
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    write_json(statistics, f"{OUTPUT_DIR}/dataset_statistics.json")
    write_markdown(statistics, f"{OUTPUT_DIR}/dataset_statistics.md")

    print(f"Wrote {OUTPUT_DIR}/dataset_statistics.json")
    print(f"Wrote {OUTPUT_DIR}/dataset_statistics.md")


def build_overall_stats(case_stats):
    total_cases = len(case_stats)
    total_facts = sum(item["fact_count"] for item in case_stats)
    total_claims = sum(item["claim_count"] for item in case_stats)
    total_evidence = sum(item["evidence_count"] for item in case_stats)
    total_gold_issues = sum(item["gold_issue_count"] for item in case_stats)

    return {
        "total_cases": total_cases,
        "average_facts_per_case": safe_average(total_facts, total_cases),
        "average_claims_per_case": safe_average(total_claims, total_cases),
        "average_evidence_per_case": safe_average(total_evidence, total_cases),
        "average_gold_issues_per_case": safe_average(total_gold_issues, total_cases)
    }


def safe_average(total, count):
    if count == 0:
        return 0
    return round(total / count, 2)


def write_json(statistics, output_path):
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(statistics, f, ensure_ascii=False, indent=2)


def write_markdown(statistics, output_path):
    overall = statistics["overall_statistics"]
    case_stats = statistics["case_level_statistics"]

    lines = [
        "# Dataset Statistics",
        "",
        "## Overall Statistics",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Total Cases | {overall['total_cases']} |",
        f"| Average Facts per Case | {overall['average_facts_per_case']} |",
        f"| Average Claims per Case | {overall['average_claims_per_case']} |",
        f"| Average Evidence per Case | {overall['average_evidence_per_case']} |",
        f"| Average Gold Issues per Case | {overall['average_gold_issues_per_case']} |",
        "",
        "## Case-Level Statistics",
        "",
        "| Case ID | Case Type | Mode | #Facts | #Claims | #Evidence | #Gold Issues | #Gold Gaps | #Role Views |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|"
    ]

    for item in case_stats:
        lines.append(
            "| {case_id} | {case_type} | {mode} | {facts} | {claims} | {evidence} | {issues} | {gaps} | {roles} |".format(
                case_id=escape_table_cell(item["case_id"]),
                case_type=escape_table_cell(item["case_type"]),
                mode=escape_table_cell(item["task_mode"]),
                facts=item["fact_count"],
                claims=item["claim_count"],
                evidence=item["evidence_count"],
                issues=item["gold_issue_count"],
                gaps=item["gold_gap_count"],
                roles=item["role_view_count"]
            )
        )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def escape_table_cell(value):
    text = str(value) if value is not None else ""
    return text.replace("\n", "<br>").replace("|", "\\|")


if __name__ == "__main__":
    main()
