import json
import sys
import os
from src.pipeline import run_pipeline
from src.report_utils import render_markdown_report
from src.data_loader import load_all_cases, load_case, load_case_file, load_split
from config.experiment import get_config


def save_outputs(state, case_id, exp_name):
    os.makedirs(f"outputs/{exp_name}/{case_id}", exist_ok=True)
    json_path = f"outputs/{exp_name}/{case_id}/state_final.json"
    md_path = f"outputs/{exp_name}/{case_id}/final_report.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_markdown_report(state))

    for mode, report in state.get("final_reports", {}).items():
        mode_state = dict(state)
        mode_state["task_mode"] = mode
        mode_state["final_report"] = report
        mode_path = f"outputs/{exp_name}/{case_id}/final_report_{mode}.md"
        with open(mode_path, "w", encoding="utf-8") as f:
            f.write(render_markdown_report(mode_state))

    print(f"JSON: {json_path}")
    print(f"报告: {md_path}")

def run_cases(cases, config):
    failed = []
    for case_data in cases:
        case_id = case_data["case_id"]
        print(f"\n正在处理 {case_id}...")
        try:
            state = run_pipeline(case_data, config)
            save_outputs(state, case_id, config["name"])
        except Exception as e:
            print(f"{case_id} 失败：{e}")
            failed.append(case_id)
    if failed:
        print(f"\n失败案件（可单独重跑）：{failed}")

def run_all_cases(config):
    run_cases(load_all_cases(), config)

def pop_exp_name(argv):
    exp_name = "full"
    if "--exp" in argv:
        i = argv.index("--exp")
        exp_name = argv[i + 1]
        del argv[i:i + 2]
    return exp_name


if __name__ == "__main__":
    exp_name = pop_exp_name(sys.argv)
    config = get_config(exp_name)

    if sys.argv[1] == "--all":
        run_all_cases(config)
        print("全部完成")
    elif sys.argv[1] == "--case":
        if len(sys.argv) < 3:
            print("缺少 case_id")
            sys.exit(1)
        case_data = load_case(sys.argv[2])
        run_cases([case_data], config)
        print(f"完成：{case_data['case_id']}")
    elif sys.argv[1] == "--split":
        if len(sys.argv) < 3:
            print("缺少 split 名称")
            sys.exit(1)
        cases = load_split(sys.argv[2])
        run_cases(cases, config)
        print(f"完成plit：{sys.argv[2]}")
    else:
        filepath = sys.argv[1]
        case_data = load_case_file(filepath)
        case_id = case_data["case_id"]
        state = run_pipeline(case_data, config)
        save_outputs(state, case_id, config["name"])

        print(f"完成：{case_id}")
