import json
import sys
import os
from src.pipeline import run_pipeline
from src.report_utils import render_markdown_report
from src.data_loader import load_all_cases, load_case, load_case_file, load_split


def save_outputs(state, case_id):
    os.makedirs(f"outputs/{case_id}", exist_ok=True)
    json_path = f"outputs/{case_id}/state_final.json"
    md_path = f"outputs/{case_id}/final_report.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_markdown_report(state))

    print(f"JSON: {json_path}")
    print(f"报告: {md_path}")

def run_cases(cases):
    for case_data in cases:
        case_id = case_data["case_id"]
        print(f"\n正在处理 {case_id}...")
        state = run_pipeline(case_data)
        save_outputs(state, case_id)

def run_all_cases():
    run_cases(load_all_cases())


if __name__ == "__main__":
    if sys.argv[1] == "--all":
        run_all_cases()
        print("全部完成")
    elif sys.argv[1] == "--case":
        if len(sys.argv) < 3:
            print("缺少 case_id")
            sys.exit(1)
        case_data = load_case(sys.argv[2])
        run_cases([case_data])
        print(f"完成：{case_data['case_id']}")
    elif sys.argv[1] == "--split":
        if len(sys.argv) < 3:
            print("缺少 split 名称")
            sys.exit(1)
        cases = load_split(sys.argv[2])
        run_cases(cases)
        print(f"完成plit：{sys.argv[2]}")
    else:
        filepath = sys.argv[1]
        case_data = load_case_file(filepath)
        case_id = case_data["case_id"]
        state = run_pipeline(case_data)
        save_outputs(state, case_id)

        print(f"完成：{case_id}")
