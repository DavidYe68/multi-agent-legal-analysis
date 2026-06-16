import json
import os
import sys
from jsonschema import validate, ValidationError

PROCESSED_DIR = "datasets/cases/processed"
GOLD_DIR = "datasets/cases/gold"
SPLIT_DIR = "datasets/splits"
CASE_SCHEMA_PATH = "datasets/schemas/case_input_schema_v2.json"
GOLD_SCHEMA_PATH = "datasets/schemas/gold_annotation_schema_v2.json"


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def validate_schema(data, schema, filepath, errors):
    try:
        validate(instance=data, schema=schema)
    except ValidationError as e:
        errors.append(f"{filepath}: {e.message}")

def check_unique(items, id_field, filepath, errors):
    ids = set()
    for item in items:
        item_id = item.get(id_field)
        if not item_id:
            errors.append(f"{filepath}: 缺少 {id_field}: {item}")
            continue
        if item_id in ids:
            errors.append(f"{filepath}: 重复的 {id_field}: {item_id}")
        ids.add(item_id)
    return ids

def check_refs(ref_ids, valid_ids, label, filepath, errors):
    for ref_id in ref_ids:
        if ref_id not in valid_ids:
            errors.append(f"{filepath}: {label} 引用了不存在的 ID: {ref_id}")

def validate_processed(case_data, filepath, all_case_ids, errors):
    fact_ids = check_unique(case_data.get("facts", []), "fact_id", filepath, errors)
    claim_ids = check_unique(case_data.get("claims", []), "claim_id", filepath, errors)
    evidence_ids = check_unique(case_data.get("evidence", []), "evidence_id", filepath, errors)

    for fact in case_data.get("facts", []):
        check_refs(
            fact.get("evidence_ids", []),
            evidence_ids,
            f"{fact.get('fact_id')} evidence_ids",
            filepath,
            errors
        )

    for claim in case_data.get("claims", []):
        check_refs(
            claim.get("supporting_evidence_ids", []),
            evidence_ids,
            f"{claim.get('claim_id')} supporting_evidence_ids",
            filepath,
            errors
        )

    for item in case_data.get("procedure", {}).get("evidence_examination", []):
        check_refs(
            [item.get("evidence_id")],
            evidence_ids,
            "procedure.evidence_examination",
            filepath,
            errors
        )

    role_views = case_data.get("role_views", {})
    for role, role_view in role_views.items():
        check_refs(role_view.get("fact_ids", []), fact_ids, f"role_views.{role}.fact_ids", filepath, errors)
        check_refs(role_view.get("claim_ids", []), claim_ids, f"role_views.{role}.claim_ids", filepath, errors)
        check_refs(role_view.get("evidence_ids", []), evidence_ids, f"role_views.{role}.evidence_ids", filepath, errors)

    paired_case_id = case_data.get("metadata", {}).get("paired_case_id")
    if paired_case_id and paired_case_id not in all_case_ids:
        errors.append(f"{filepath}: paired_case_id 不存在: {paired_case_id}")


def validate_gold(gold_data, filepath, processed_case, all_case_ids, errors):
    fact_ids = set()
    for item in processed_case.get("facts", []):
        fact_ids.add(item.get("fact_id"))

    evidence_ids = set()
    for item in processed_case.get("evidence", []):
        evidence_ids.add(item.get("evidence_id"))

    issue_ids = check_unique(gold_data.get("gold_issues", []), "issue_id", filepath, errors)

    for item in gold_data.get("gold_fact_status", []):
        check_refs([item.get("fact_id")], fact_ids, "gold_fact_status", filepath, errors)

    for issue in gold_data.get("gold_issues", []):
        check_refs(issue.get("related_fact_ids", []), fact_ids, f"{issue.get('issue_id')} related_fact_ids", filepath, errors)
        check_refs(issue.get("related_evidence_ids", []), evidence_ids, f"{issue.get('issue_id')} related_evidence_ids", filepath, errors)

    for item in gold_data.get("gold_evidence_issue_map", []):
        check_refs([item.get("evidence_id")], evidence_ids, "gold_evidence_issue_map.evidence_id", filepath, errors)
        check_refs([item.get("issue_id")], issue_ids, "gold_evidence_issue_map.issue_id", filepath, errors)

    for item in gold_data.get("gold_evidence_gaps", []):
        check_refs([item.get("issue_id")], issue_ids, "gold_evidence_gaps.issue_id", filepath, errors)

    paired_case_id = gold_data.get("pair_expectation", {}).get("paired_case_id")
    if paired_case_id and paired_case_id not in all_case_ids:
        errors.append(f"{filepath}: pair_expectation.paired_case_id 不存在: {paired_case_id}")

def validate_splits(all_case_ids, errors):
    split_count = 0
    for filename in sorted(os.listdir(SPLIT_DIR)):
        if not filename.endswith(".json"):
            continue
        split_path = f"{SPLIT_DIR}/{filename}"
        split_count += 1
        case_ids = read_json(split_path)
        seen = set()
        for case_id in case_ids:
            if case_id in seen:
                errors.append(f"{split_path}: split 中重复 case_id: {case_id}")
            if case_id not in all_case_ids:
                errors.append(f"{split_path}: split 引用了不存在的 case_id: {case_id}")
            seen.add(case_id)
    return split_count

def main():
    errors = []
    case_schema = read_json(CASE_SCHEMA_PATH)
    gold_schema = read_json(GOLD_SCHEMA_PATH)

    processed_cases = {}
    gold_cases = {}

    for filename in sorted(os.listdir(PROCESSED_DIR)):
        if not filename.endswith(".json"):
            continue
        case_path = f"{PROCESSED_DIR}/{filename}"
        case_data = read_json(case_path)
        validate_schema(case_data, case_schema, case_path, errors)
        case_id = filename.replace(".json", "")
        processed_cases[case_data.get("case_id", case_id)] = case_data

    for filename in sorted(os.listdir(GOLD_DIR)):
        if not filename.endswith(".json"):
            continue
        gold_path = f"{GOLD_DIR}/{filename}"
        gold_data = read_json(gold_path)
        validate_schema(gold_data, gold_schema, gold_path, errors)
        case_id = filename.replace("_gold.json", "")
        gold_cases[gold_data.get("case_id", case_id)] = gold_data

    processed_ids = set(processed_cases.keys())
    gold_ids = set(gold_cases.keys())

    for case_id in sorted(processed_ids - gold_ids):
        errors.append(f"缺少 gold 文件: {case_id}")
    for case_id in sorted(gold_ids - processed_ids):
        errors.append(f"gold 没有对应 processed: {case_id}")

    for case_id, case_data in processed_cases.items():
        validate_processed(case_data, case_id, processed_ids, errors)

    for case_id, gold_data in gold_cases.items():
        if case_id in processed_cases:
            validate_gold(gold_data, case_id, processed_cases[case_id], processed_ids, errors)

    split_count = validate_splits(processed_ids, errors)

    print("数据集校验结果")
    print(f"processed 案件数: {len(processed_cases)}")
    print(f"gold 标注数: {len(gold_cases)}")
    print(f"split 文件数: {split_count}")

    if errors:
        print(f"发现问题: {len(errors)}")
        for error in errors:
            print(f"- {error}")
        sys.exit(1)

    print("全部通过：schema、ID 引用、processed/gold 对应关系、splits 均有效。")


if __name__ == "__main__":
    main()
