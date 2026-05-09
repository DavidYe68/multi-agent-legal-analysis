import json
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
CASE_DIR = ROOT_DIR / "data" / "cases"
OUTPUT_DIR = ROOT_DIR / "outputs"

VALID_PERSONALITY_FIELDS = {
    "strictness",
    "agreeableness",
    "risk_aversion",
    "openness"
}

CASE_TYPE_MAP = {
    "helping_information_network_crime": "帮信罪：主观明知争议",
    "theft_illegal_possession_intent": "盗窃罪：非法占有目的争议",
    "intentional_injury_causation": "故意伤害罪：因果关系与伤情争议",
    "traffic_accident_negligence": "交通肇事罪：过失与责任比例争议",
    "fraud_illegal_possession_victim_mistake": "诈骗罪：非法占有目的与认识错误争议"
}


def main():
    case_stats = []
    personality_dimensions = {}

    for case_path in sorted(CASE_DIR.glob("*.json")):
        with case_path.open("r", encoding="utf-8") as f:
            case_data = json.load(f)

        role_info = case_data.get("role_information", {})
        prosecutor_info = role_info.get("prosecutor_info", {})
        defense_info = role_info.get("defense_lawyer_info", {})
        reviewer_profiles = case_data.get("reviewer_personality_profiles", {})

        issues = case_data.get("main_issues") or case_data.get("issues") or []
        prosecutor_evidence = prosecutor_info.get("evidences", [])
        defense_evidence = defense_info.get("available_evidence", [])

        for profile in reviewer_profiles.values():
            for dimension in profile:
                if dimension in VALID_PERSONALITY_FIELDS:
                    personality_dimensions[dimension] = (
                        personality_dimensions.get(dimension, 0) + 1
                    )

        case_stats.append({
            "case_id": case_data.get("case_id", case_path.stem),
            "case_type": infer_case_type(case_data, case_path),
            "main_issues_count": len(issues),
            "prosecutor_evidence_count": len(prosecutor_evidence),
            "defense_available_evidence_count": len(defense_evidence),
            "evidence_count": len(prosecutor_evidence) + len(defense_evidence),
            "reviewer_count": len(reviewer_profiles)
        })

    overall_stats = build_overall_stats(case_stats, personality_dimensions)
    statistics = {
        "overall_statistics": overall_stats,
        "case_level_statistics": case_stats
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_json(statistics, OUTPUT_DIR / "dataset_statistics.json")
    write_markdown(statistics, OUTPUT_DIR / "dataset_statistics.md")

    print(f"Wrote {OUTPUT_DIR / 'dataset_statistics.json'}")
    print(f"Wrote {OUTPUT_DIR / 'dataset_statistics.md'}")


def infer_case_type(case_data, case_path):
    domain_hint = case_data.get("domain_hint", "")
    if domain_hint in CASE_TYPE_MAP:
        return CASE_TYPE_MAP[domain_hint]
    return domain_hint or case_path.stem


def build_overall_stats(case_stats, personality_dimensions):
    total_cases = len(case_stats)
    total_issues = sum(item["main_issues_count"] for item in case_stats)
    total_evidence = sum(item["evidence_count"] for item in case_stats)
    total_reviewers = sum(item["reviewer_count"] for item in case_stats)

    return {
        "total_cases": total_cases,
        "average_issues_per_case": safe_average(total_issues, total_cases),
        "average_evidence_items": safe_average(total_evidence, total_cases),
        "total_reviewers": total_reviewers,
        "personality_dimensions": personality_dimensions
    }


def safe_average(total, count):
    if count == 0:
        return 0
    return round(total / count, 2)


def write_json(statistics, output_path):
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(statistics, f, ensure_ascii=False, indent=2)


def write_markdown(statistics, output_path):
    overall = statistics["overall_statistics"]
    case_stats = statistics["case_level_statistics"]
    dimensions = overall["personality_dimensions"]
    dimension_text = ", ".join(
        f"{name} ({count})"
        for name, count in sorted(dimensions.items())
    ) or "None"

    lines = [
        "# Dataset Statistics",
        "",
        "## Overall Statistics",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Total Cases | {overall['total_cases']} |",
        f"| Average Issues per Case | {overall['average_issues_per_case']} |",
        f"| Average Evidence Items | {overall['average_evidence_items']} |",
        f"| Total Reviewers | {overall['total_reviewers']} |",
        f"| Personality Dimensions | {escape_table_cell(dimension_text)} |",
        "",
        "## Case-Level Statistics",
        "",
        "| Case ID | Case Type | #Issues | #Evidence | #Reviewers |",
        "|---|---|---:|---:|---:|"
    ]

    for item in case_stats:
        lines.append(
            "| {case_id} | {case_type} | {issues} | {evidence} | {reviewers} |".format(
                case_id=escape_table_cell(item["case_id"]),
                case_type=escape_table_cell(item["case_type"]),
                issues=item["main_issues_count"],
                evidence=item["evidence_count"],
                reviewers=item["reviewer_count"]
            )
        )

    with output_path.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def escape_table_cell(value):
    text = str(value) if value is not None else ""
    return text.replace("\n", "<br>").replace("|", "\\|")


if __name__ == "__main__":
    main()
