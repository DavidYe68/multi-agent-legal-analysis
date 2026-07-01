import json

PRACTICE_SPLIT_PATH = "datasets/splits/practice_validation.json"


def load_practice_cases(path=PRACTICE_SPLIT_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return set(json.load(f))


# practice 验证案件：baseline 与多 Agent 系统都对这些案件同时出 teaching/practice 两份报告
PRACTICE_CASES = load_practice_cases()


def modes_for_case(case_id, default_mode):
    """返回该案件需要生成报告的模式列表。

    practice 验证案件同时出 teaching/practice；其余只出默认模式。
    始终包含 default_mode，避免 final_reports[default_mode] 取不到键。
    """
    if case_id in PRACTICE_CASES:
        modes = ["teaching", "practice"]
        if default_mode not in modes:
            modes.append(default_mode)
        return modes
    return [default_mode]


def build_reports_for_modes(modes, default_mode, produce_report):
    """对每个 mode 调用 produce_report(mode) -> report，并汇总成 final_reports。

    非默认模式失败时跳过（容错），默认模式失败则抛出。
    返回 (final_reports, final_reports[default_mode])。
    """
    final_reports = {}
    for mode in modes:
        try:
            final_reports[mode] = produce_report(mode)
        except Exception as e:
            if mode == default_mode:
                raise
            print(f"[modes] {mode} 模式生成失败，跳过：{e}")
    return final_reports, final_reports[default_mode]
