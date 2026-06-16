import json
import os
from jsonschema import validate, ValidationError

CASE_DIR = "datasets/cases/processed"
SPLIT_DIR = "datasets/splits"
SCHEMA_PATH = "datasets/schemas/case_input_schema_v2.json"

def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def validate_case_schema(case_data, filepath=""):
    schema = read_json(SCHEMA_PATH)
    try:
        validate(instance=case_data, schema=schema)
    except ValidationError as e:
        where = f" {filepath}" if filepath else ""
        raise ValueError(f"格式出错{where}: {e.message}")

def build_index(items, id_field):
    index = {}
    for item in items:
        index[item[id_field]] = item

    return index

def add_indexes(case_data):
    case_data["fact_index"] = build_index(case_data["facts"], "fact_id")
    case_data["claim_index"] = build_index(case_data["claims"], "claim_id")
    case_data["evidence_index"] = build_index(case_data["evidence"], "evidence_id")
    return case_data

def load_case_file(case_path):
    case_data = read_json(case_path)
    validate_case_schema(case_data, case_path)
    return add_indexes(case_data)

def load_case(case_id):
    case_path = f"{CASE_DIR}/{case_id}.json"

    return load_case_file(case_path)

def load_split(split_name):
    split_path = f"{SPLIT_DIR}/{split_name}.json"

    case_ids = read_json(split_path)
    cases = []
    for case_id in case_ids:
        cases.append(load_case(case_id))
    return cases

def load_all_cases():
    cases = []
    for filename in sorted(os.listdir(CASE_DIR)):
        if filename.endswith(".json"):
            case_path = f"{CASE_DIR}/{filename}"
            cases.append(load_case_file(case_path))
    return cases
