"""法律多智能体系统——最终案件分析报告（Markdown）渲染。

报告直接读取 pipeline 产出的 state 中各 Agent 的**一手结构化结论**
（issue_spotter / prosecutor / defense_lawyer / defendant / judge /
deliberation_room / foreperson / writer），按刑事案件分析的法学体例组织成报告。

设计原则（对应 6-15.md）：
- 以稳定标识贯穿全文：争点 I*、证据 E*、事实 F*，便于核验、聚合与复现；
- 优先呈现各 Agent 的一手结论（如 Judge 的 issue_response_table、控辩按争点的论证、
  证据—争点对应），而非仅依赖 Writer 的二手摘要，避免细节丢失或失真；
- 证明状态保守呈现（closed/partly_closed/open → 已证成/部分证成/未证成·存疑），
  对存疑争点不强行给出确定结论，并显式提示「存疑有利于被告」；
- gold annotation 不参与渲染；字段缺失时跳过对应小节，绝不以默认值充数。

对外仅暴露 render_markdown_report(state) -> str（供 src/main.py 调用）。
"""

# --------------------------------------------------------------------------- #
# 术语映射（英文枚举 → 法学中文表述）
# --------------------------------------------------------------------------- #

PROOF_STATUS_LABELS = {
    "closed": "已证成",
    "partly_closed": "部分证成",
    "open": "未证成·存疑",
}

POSITION_LABELS = {
    "guilty": "倾向有罪",
    "not_guilty": "倾向无罪",
    "partial": "部分成立",
    "unclear": "尚难定论",
}

EXAM_STATUS_LABELS = {
    "examined": "已质证",
    "not_examined": "未质证",
    "disputed": "有争议",
    "pending": "待审查",
}

MODE_LABELS = {"teaching": "教学模式", "practice": "实务模式"}

# _flatten 从字典中提取可读文本时优先尝试的键（按法学语义排序）
_TEXT_KEYS = (
    "issue_text", "issue", "claim", "core_response", "defense_rebuttal",
    "point", "view", "content", "text", "gap", "question", "suggestion",
    "statement", "description", "reason", "note", "summary",
)

_CN_DIGITS = "零一二三四五六七八九十"


# --------------------------------------------------------------------------- #
# 文本与表格工具
# --------------------------------------------------------------------------- #

def _flatten(value) -> str:
    """把任意结构（str/dict/list/标量）归一化为一行可读文本。"""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in _TEXT_KEYS:
            if value.get(key):
                return _flatten(value[key])
        parts = [_flatten(v) for v in value.values() if v not in (None, "", [], {})]
        return "；".join(p for p in parts if p)
    if isinstance(value, (list, tuple)):
        return "；".join(p for p in (_flatten(v) for v in value) if p)
    return str(value)


def _clip(text: str, limit: int = 60) -> str:
    text = _flatten(text)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _cell(value) -> str:
    """表格单元格：转义竖线与换行，避免破坏 Markdown 表格。"""
    return _flatten(value).replace("\n", "<br>").replace("|", "\\|")


def _bullets(value, prefix: str = "- ") -> list:
    """把列表/字典/字符串渲染成 Markdown 列表项；无内容返回空列表。"""
    if not value:
        return []
    if isinstance(value, str):
        text = value.strip()
        return [f"{prefix}{text}"] if text else []
    items = value.values() if isinstance(value, dict) else value
    lines = []
    for item in items:
        text = _flatten(item)
        if text:
            lines.append(f"{prefix}{text}")
    return lines


def _id_list(ids) -> str:
    ids = [i for i in (ids or []) if i]
    return "、".join(ids) if ids else "—"


def _as_dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _normalize_votes(votes):
    """把表决记录归一化为 (第一轮分布, 第二轮分布)，兼容 dict 与 list 两种形态。"""
    if isinstance(votes, dict):
        return _as_dict(votes.get("round1")), _as_dict(votes.get("round2"))
    rounds = {1: {}, 2: {}}
    if isinstance(votes, list):
        for entry in votes:
            if not isinstance(entry, dict):
                continue
            rid = entry.get("round_id") or entry.get("round")
            if rid in rounds:
                rounds[rid] = entry.get("vote_count") or entry.get("votes") or {}
    return rounds[1], rounds[2]


def _proof(status) -> str:
    return PROOF_STATUS_LABELS.get(status, _flatten(status) or "—")


def _position(value) -> str:
    return POSITION_LABELS.get(value, _flatten(value) or "—")


def _md_table(headers: list, rows: list) -> list:
    """生成带前后空行的 Markdown 表格；无数据行返回空列表。"""
    if not rows:
        return []
    out = [
        "",
        "| " + " | ".join(headers) + " |",
        "|" + "---|" * len(headers),
    ]
    for row in rows:
        out.append("| " + " | ".join(_cell(c) for c in row) + " |")
    out.append("")
    return out


def _cn_numeral(n: int) -> str:
    if n <= 10:
        return _CN_DIGITS[n]
    if n < 20:
        return "十" + _CN_DIGITS[n - 10]
    return str(n)


# --------------------------------------------------------------------------- #
# 索引：稳定 ID → 可读标签
# --------------------------------------------------------------------------- #

def _evidence_labels(state: dict) -> dict:
    items = state.get("evidence") or list((state.get("evidence_index") or {}).values())
    labels = {}
    for ev in items:
        if isinstance(ev, dict) and ev.get("evidence_id"):
            labels[ev["evidence_id"]] = _clip(ev.get("content") or ev.get("summary") or "", 28)
    return labels


def _issue_labels(state: dict) -> dict:
    labels = {}
    for item in _as_dict(state.get("issues")).get("issues", []):
        if isinstance(item, dict) and item.get("issue_id"):
            labels[item["issue_id"]] = item.get("issue_text", "")
    return labels


def _index_by_issue(items) -> dict:
    grouped = {}
    for item in items or []:
        issue_id = item.get("issue_id") if isinstance(item, dict) else None
        if issue_id:
            grouped.setdefault(issue_id, []).append(item)
    return grouped


# --------------------------------------------------------------------------- #
# 报告各小节（每个函数返回 (标题, 行列表)，行列表为空则整节略去）
# --------------------------------------------------------------------------- #

def _section_overview(state: dict):
    report = state.get("final_report") or {}
    narrative = state.get("case_narrative") or {}
    summary = (
        report.get("case_summary")
        or narrative.get("neutral_summary")
        or state.get("raw_case_text")
    )
    lines = []
    if summary:
        lines.append(_flatten(summary))

    timeline = narrative.get("timeline") or []
    if timeline:
        lines += ["", "**案件时间线**"]
        for event in timeline:
            label = event.get("time_label") or event.get("event_id") or ""
            content = _flatten(event.get("content"))
            if content:
                lines.append(f"- {label}：{content}" if label else f"- {content}")
    return "案情概述", lines


def _section_issues(state: dict):
    issues = _as_dict(state.get("issues")).get("issues", [])
    if not issues:
        return "争点梳理", _bullets(_as_dict(state.get("final_report")).get("core_issues"))

    rows = []
    for item in issues:
        rows.append((
            item.get("issue_id", ""),
            item.get("issue_text", ""),
            item.get("importance") or item.get("issue_type") or "—",
            _id_list(item.get("related_evidence_ids")),
        ))
    return "争点梳理", _md_table(["争点ID", "争点", "重要性", "关联证据"], rows)


def _section_adversarial(state: dict):
    prosecutor = state.get("prosecutor_analysis") or {}
    defense = state.get("defense_analysis") or {}
    issue_labels = _issue_labels(state)

    pros_args = _index_by_issue(prosecutor.get("arguments_by_issue"))
    def_args = _index_by_issue(defense.get("arguments_by_issue"))
    def_rebuts = _index_by_issue(defense.get("rebuttals_to_accusation"))

    order = [i.get("issue_id") for i in _as_dict(state.get("issues")).get("issues", []) if i.get("issue_id")]
    for issue_id in list(pros_args) + list(def_args) + list(def_rebuts):
        if issue_id not in order:
            order.append(issue_id)

    lines = []
    for issue_id in order:
        pros = pros_args.get(issue_id, [])
        deff = def_args.get(issue_id, [])
        rebuts = def_rebuts.get(issue_id, [])
        if not (pros or deff or rebuts):
            continue

        label = issue_labels.get(issue_id, "")
        lines += ["", f"**{issue_id}**" + (f"｜{label}" if label else ""), ""]
        for arg in pros:
            ev = _id_list(arg.get("evidence_ids"))
            seg = f"- 公诉主张：{_flatten(arg.get('claim'))}"
            if ev != "—":
                seg += f"（依据证据 {ev}）"
            lines.append(seg)
            reasoning = _clip(arg.get("reasoning"), 80)
            if reasoning:
                lines.append(f"  - 论证：{reasoning}")
        for arg in deff:
            ev = _id_list(arg.get("evidence_ids"))
            seg = f"- 辩护主张：{_flatten(arg.get('claim'))}"
            if ev != "—":
                seg += f"（依据证据 {ev}）"
            lines.append(seg)
            reasoning = _clip(arg.get("reasoning"), 80)
            if reasoning:
                lines.append(f"  - 论证：{reasoning}")
        for rebut in rebuts:
            response = _flatten(rebut.get("core_response") or rebut.get("defense_rebuttal"))
            if response:
                lines.append(f"- 辩护反驳：{response}")

    if not lines:  # 无按争点的结构化论证时，回退到 Writer 汇总的控辩观点
        report = _as_dict(state.get("final_report"))
        pros_view = _bullets(report.get("prosecutor_view"))
        def_view = _bullets(report.get("defense_view"))
        if pros_view:
            lines += ["**公诉方观点**", *pros_view]
        if def_view:
            lines += ["", "**辩护方观点**", *def_view]

    statement = state.get("defendant_statement") or {}
    attitude = _flatten(statement.get("attitude_to_accusation"))
    personal = _flatten(statement.get("personal_statement"))
    if attitude or personal:
        lines += ["", "**被告人陈述**"]
        if attitude:
            lines.append(f"- 对指控态度：{attitude}")
        if personal:
            lines.append(f"- 当庭陈述：{_clip(personal, 120)}")
        for item in _bullets(statement.get("uncertain_or_avoided_points")):
            lines.append(f"- 回避/存疑：{item[2:]}")

    while lines and lines[0] == "":
        lines.pop(0)
    return "控辩论点（按争点）", lines


def _section_evidence(state: dict):
    prosecutor = state.get("prosecutor_analysis") or {}
    defense = state.get("defense_analysis") or {}
    procedure = state.get("procedure") or {}
    labels = _evidence_labels(state)

    pros_map = {e.get("evidence_id"): e for e in prosecutor.get("evidence_issue_map", []) if e.get("evidence_id")}
    def_map = {c.get("evidence_id"): c for c in defense.get("evidence_challenges", []) if c.get("evidence_id")}
    exam_map = {x.get("evidence_id"): x for x in procedure.get("evidence_examination", []) if x.get("evidence_id")}

    evidence_ids = []
    for eid in list(pros_map) + list(def_map) + list(labels):
        if eid not in evidence_ids:
            evidence_ids.append(eid)
    if not evidence_ids:
        return "证据评析", []

    rows = []
    for eid in evidence_ids:
        pros = pros_map.get(eid, {})
        deff = def_map.get(eid, {})
        exam = exam_map.get(eid, {})

        purpose = _flatten(pros.get("proving_purpose"))
        strength = _flatten(pros.get("prosecution_strength"))
        purpose_cell = (purpose + (f"（{strength}）" if strength else "")) if purpose else "—"
        challenge = _flatten(
            deff.get("defense_conclusion")
            or deff.get("probative_value_challenge")
            or deff.get("authenticity_challenge")
        ) or "—"
        exam_cell = EXAM_STATUS_LABELS.get(exam.get("status"), _flatten(exam.get("status")) or "—")

        rows.append((
            eid,
            _clip(labels.get(eid, ""), 26),
            _id_list(pros.get("issue_ids")),
            _clip(purpose_cell, 40),
            _clip(challenge, 40),
            exam_cell,
        ))

    headers = ["证据ID", "内容", "指向争点", "公诉证明目的（强度）", "辩护质证", "审查"]
    return "证据评析", _md_table(headers, rows)


def _section_judge(state: dict):
    judge = state.get("judge_summary") or {}
    issue_labels = _issue_labels(state)
    lines = []

    table = judge.get("issue_response_table") or []
    if table:
        rows = []
        for row in table:
            issue_id = row.get("issue_id", "")
            rows.append((
                issue_id,
                _clip(issue_labels.get(issue_id, ""), 22),
                _proof(row.get("current_status")),
                _id_list(row.get("supporting_evidence_ids")),
                _id_list(row.get("opposing_evidence_ids")),
                _clip(row.get("reason"), 50),
                _clip(row.get("remaining_gap"), 40),
            ))
        headers = ["争点ID", "争点", "证明状态", "支持证据", "反对证据", "理由", "剩余缺口"]
        lines += _md_table(headers, rows)
    else:  # 兼容旧版 Judge 输出（无 issue_response_table）
        for label, key in (("最终主要争点", "final_main_issues"),
                            ("已查明", "resolved_points"),
                            ("未决/存疑", "unresolved_points")):
            bullets = _bullets(judge.get(key))
            if bullets:
                lines += ["", f"**{label}**", *bullets]

    observations = _bullets(judge.get("judge_observations"))
    if observations:
        lines += ["", "**法官观察**", *observations]

    tendency = judge.get("preliminary_judgment_tendency")
    if tendency:
        lines += ["", f"**初步心证倾向**：{_position(tendency)}"]

    while lines and lines[0] == "":
        lines.pop(0)
    return "法官争点评议", lines


def _section_deliberation(state: dict):
    room = state.get("deliberation_room") or {}
    foreperson = state.get("foreperson_summary") or {}
    reviewer_summary = (state.get("final_report") or {}).get("reviewer_summary") or {}
    issue_labels = _issue_labels(state)
    lines = []

    round1, round2 = _normalize_votes(room.get("vote_history"))

    def fmt_votes(dist):
        return "、".join(f"{_position(k)} {v}" for k, v in dist.items()) if dist else "—"

    if round1 or round2:
        lines.append(f"**表决变化**：第一轮 [{fmt_votes(round1)}] → 第二轮 [{fmt_votes(round2)}]")
    elif foreperson.get("vote_summary"):
        lines.append(f"**表决结果**：{fmt_votes(_as_dict(foreperson.get('vote_summary')))}")

    def pick_view(fore_val, review_val):
        # foreperson 若只给出裸枚举（如 not_guilty），优先采用更详细的评议摘要
        fore_text = _flatten(fore_val)
        if fore_text in POSITION_LABELS:
            return _flatten(review_val) or _position(fore_text)
        return fore_text or _flatten(review_val)

    majority = pick_view(foreperson.get("majority_view"), reviewer_summary.get("majority_view"))
    minority = pick_view(foreperson.get("minority_view"), reviewer_summary.get("minority_view"))
    if majority:
        lines.append(f"**多数意见**：{majority}")
    if minority:
        lines.append(f"**少数意见**：{minority}")

    for label, key in (("共识点", "consensus_points"),
                       ("分歧点", "disagreement_points"),
                       ("保留意见", "reserved_points")):
        bullets = _bullets(foreperson.get(key))
        if bullets:
            lines += ["", f"**{label}**", *bullets]

    final_status = (room.get("final_meeting_result") or {}).get("final_issue_status") or []
    if final_status:
        rows = []
        for row in final_status:
            issue_id = row.get("issue_id", "")
            rows.append((
                issue_id,
                _clip(row.get("issue") or row.get("issue_text") or issue_labels.get(issue_id, ""), 22),
                _proof(row.get("final_status")),
                _clip(row.get("supporting_reason"), 60),
                _clip(row.get("remaining_gap"), 40),
            ))
        lines += ["", "**争点最终证明状态**"]
        lines += _md_table(["争点ID", "争点", "最终状态", "主要理由", "剩余缺口"], rows)
        lines.append("> 状态口径：已证成 / 部分证成 / 未证成·存疑（对应 closed / partly_closed / open），平票时取最保守状态。")

    note = _flatten(foreperson.get("final_deliberation_note"))
    if note:
        lines += ["", f"**合议庭说明**：{note}"]

    while lines and lines[0] == "":
        lines.pop(0)
    return "合议庭评议（多视角）", lines


def _section_gaps(state: dict):
    judge = state.get("judge_summary") or {}
    foreperson = state.get("foreperson_summary") or {}
    report = state.get("final_report") or {}

    def render(items):
        seen, lines = set(), []
        for item in items or []:
            if isinstance(item, dict) and "gap" in item:
                issue_id = item.get("issue_id", "")
                text = _flatten(item.get("gap"))
                text = f"{issue_id}：{text}" if issue_id else text
            else:
                text = _flatten(item)
            key = text.strip()
            if key and key not in seen:
                seen.add(key)
                lines.append(f"- {text}")
        return lines

    # 取首个非空来源，优先采用 Judge 的争点关联缺口，避免三处来源近义重复
    for source in (judge.get("evidence_gaps"),
                   foreperson.get("evidence_gap_summary"),
                   report.get("evidence_gaps")):
        lines = render(source)
        if lines:
            return "证据缺口", lines
    return "证据缺口", []


def _section_conclusion(state: dict):
    judge = state.get("judge_summary") or {}
    final_status = (
        (state.get("deliberation_room") or {}).get("final_meeting_result") or {}
    ).get("final_issue_status") or []
    lines = []

    tendency = judge.get("preliminary_judgment_tendency")
    if tendency:
        lines.append(f"- 法官初步心证倾向：{_position(tendency)}")

    if final_status:
        open_items = [r for r in final_status if r.get("final_status") == "open"]
        if open_items:
            refs = "、".join(
                r.get("issue_id") or _clip(r.get("issue") or r.get("issue_text"), 16)
                for r in open_items
            )
            lines.append(
                f"- 安全结论：争点 {refs} 仍未证成，现有证据尚未达到"
                "「事实清楚，证据确实、充分」的定罪标准；依存疑有利于被告原则，不应作出对被告人不利的确定认定。"
            )
        else:
            lines.append(
                "- 安全结论：主要争点已证成或部分证成，但仍须结合全案证据综合判断，"
                "避免作出超出在案证据的过度结论。"
            )

    reasons = _bullets(judge.get("uncertainty_reasons"))
    if reasons:
        lines.append("- 不确定性来源：")
        lines += [f"  {r}" for r in reasons]

    return "结论与不确定性", lines


def _sections_by_mode(state: dict):
    report = state.get("final_report") or {}
    mode = state.get("task_mode") or report.get("mode_hint") or state.get("user_mode")
    sections = []
    if mode == "practice":
        sections.append(("风险提示", _bullets(report.get("risk_flags"))))
        sections.append(("下一步建议", _bullets(report.get("next_step_suggestions"))))
    else:  # teaching / 未指定
        sections.append(("教学讨论问题", _bullets(report.get("open_questions"))))
    return sections


# --------------------------------------------------------------------------- #
# 报告头 + 汇总
# --------------------------------------------------------------------------- #

def _header(state: dict) -> list:
    report = state.get("final_report") or {}
    case_id = state.get("case_id", "")
    mode = state.get("task_mode") or report.get("mode_hint") or state.get("user_mode") or ""
    domain = state.get("domain") or state.get("domain_hint") or ""
    title = state.get("title") or ""

    meta = [f"**模式**：{MODE_LABELS.get(mode, mode or '—')}"]
    if domain:
        meta.append(f"**领域/罪名**：{domain}")
    if title:
        meta.append(f"**案由**：{title}")

    return [
        f"# 案件分析报告 · {case_id}",
        "",
        " ｜ ".join(meta),
        "",
        "> 本报告以稳定标识贯穿全文（争点 I*、证据 E*、事实 F*）；证明状态采保守口径，"
        "对存疑争点不作确定结论；金标准（gold）不参与生成。",
    ]


def _collapse_blanks(lines: list) -> list:
    out = []
    for line in lines:
        if line == "" and (not out or out[-1] == ""):
            continue
        out.append(line)
    return out


def render_markdown_report(state: dict) -> str:
    """把 pipeline 产出的 state 渲染为法学体例的 Markdown 案件分析报告。"""
    state = state or {}

    sections = [
        _section_overview(state),
        _section_issues(state),
        _section_adversarial(state),
        _section_evidence(state),
        _section_judge(state),
        _section_deliberation(state),
        _section_gaps(state),
        _section_conclusion(state),
        *_sections_by_mode(state),
    ]

    out = _header(state)
    index = 0
    for title, body in sections:
        if not body:
            continue
        index += 1
        out += ["", f"## {_cn_numeral(index)}、{title}", "", *body]

    return "\n".join(_collapse_blanks(out)).rstrip() + "\n"
