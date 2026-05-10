
from src.state_manager import create_state
from src.logger import Logger

from src.agents.clerk import ClerkAgent
from src.agents.issue_spotter import IssueSpotterAgent
from src.agents.prosecutor import ProsecutorAgent
from src.agents.defense_lawyer import DefenseLawyerAgent
from src.agents.defendant import DefendantAgent
from src.agents.judge import JudgeAgent
from src.agents.reviewer import ReviewerAgent
from src.agents.foreperson import ForepersonAgent
from src.agents.writer import WriterAgent
import json
from src.llm_client import call_llm

def run_pipeline(case_data):

    linear_agents = [
        ClerkAgent(),
        IssueSpotterAgent(),
        ProsecutorAgent(),
        DefenseLawyerAgent(),
        DefendantAgent(),
        JudgeAgent()
    ]

    state = create_state(case_data)
    logger = Logger()

    for agent in linear_agents:
        state = agent.run(state, logger)

    reviewers = [
        ReviewerAgent("legal", "legal_reviewer_round1"),
        ReviewerAgent("social", "social_reviewer_round1"),
        ReviewerAgent("expert", "expert_reviewer_round1"),
        ReviewerAgent("public", "public_reviewer_round1")
    ]

    reviewer_outputs = []
    for reviewer in reviewers:
        state = reviewer.run(state, logger)
        reviewer_outputs.append(state["reviewer_output"])

    # Round 2
    with open("prompts/round2_prompt.txt", "r", encoding="utf-8") as f:
        round2_prompt = f.read()

    round2_outputs = []
    for i, reviewer in enumerate(reviewers):
        my_review = reviewer_outputs[i]
        other_reviews = [r for j, r in enumerate(reviewer_outputs) if j != i]

        role_key = ["legal", "social", "expert", "public"][i]
        personality = state.get("reviewer_personality_profiles", {}).get(f"{role_key}_reviewer", {})

        round2_input = json.dumps({
            "judge_summary": state["judge_summary"],
            "my_round1_review": my_review,
            "other_round1_reviews": other_reviews,
            "reviewer_personality": personality
        }, ensure_ascii=False)    

        print(f"[{reviewer.name}_round2] 开始调用 LLM...")
        result = call_llm(round2_prompt, round2_input)
        print(f"[{reviewer.name}_round2] 完成")

        round2_outputs.append(result)
        logger.log(f"{reviewer.name}_round2", {"round": 2}, result)

    state["round2_outputs"] = round2_outputs

    state["reviewer_outputs"] = reviewer_outputs

    participants = [
        "legal_reviewer",
        "social_reviewer",
        "expert_reviewer",
        "public_reviewer"
    ]

    def get_reviewer_type(output, index):
        agent_id = output.get("agent_id")
        if agent_id:
            return agent_id

        role = output.get("role") or output.get("reviewer_type")
        if role:
            if role.endswith("_reviewer"):
                return role
            return f"{role}_reviewer"

        if index < len(participants):
            return participants[index]

        return ""

    rounds = [
        {
            "round_id": 1,
            "round_type": "opening_statement",
            "speeches": reviewer_outputs
        },
        {
            "round_id": 2,
            "round_type": "response",
            "speeches": round2_outputs
        }
    ]

    # 第二轮才是评议后的真实倾向，所以投票只看 position_after。
    vote_count = {}
    for r in round2_outputs:
        tendency = r.get("position_after", "unclear")
        vote_count[tendency] = vote_count.get(tendency, 0) + 1

    majority_position = "unclear"
    if vote_count:
        majority_position = max(vote_count, key=vote_count.get)

    vote_history = [
        {
            "round_id": 2,
            "vote_count": vote_count,
            "majority_position": majority_position
        }
    ]

    valid_votes = [
        r.get("position_after")
        for r in round2_outputs
        if r.get("position_after") in ["guilty", "not_guilty", "partial", "unclear"]
    ]
    is_consensus_reached = (
        len(valid_votes) == len(round2_outputs)
        and len(set(valid_votes)) == 1
        and len(valid_votes) > 0
    )

    # 谁在第二轮后更接近谁。
    alliance_map = {}
    for i, r in enumerate(round2_outputs):
        reviewer_type = get_reviewer_type(r, i)
        alliance_map[reviewer_type] = r.get("new_allies", [])

    # 分歧既保留每个人自己的总结，也记录明确回应关系。
    disagreement_by_agent = {}
    disagreement_relations = []
    for i, r in enumerate(round2_outputs):
        reviewer_type = get_reviewer_type(r, i)
        disagreement_by_agent[reviewer_type] = r.get("remaining_disagreement", "")

        for response in r.get("respond_to", []):
            relation = response.get("relation", "")
            if relation in ["disagree", "partially_agree"]:
                disagreement_relations.append({
                    "agent": reviewer_type,
                    "target_agent": response.get("target_agent", ""),
                    "relation": relation,
                    "issue": response.get("issue", ""),
                    "target_point": response.get("target_point", ""),
                    "response_reason": response.get("response_reason", "")
                })

    disagreement_map = {
        "by_agent": disagreement_by_agent,
        "relations": disagreement_relations
    }

    state_changes = []
    for i, r in enumerate(round2_outputs):
        issue_status_updates = r.get("issue_status_updates", [])
        position_changed = r.get("position_changed", False)
        position_changed_bool = position_changed is True
        if isinstance(position_changed, str):
            position_changed_bool = position_changed.lower() == "true"

        if position_changed_bool or issue_status_updates:
            state_changes.append({
                "agent": get_reviewer_type(r, i),
                "position_before": r.get("position_before", ""),
                "position_after": r.get("position_after", ""),
                "position_changed": position_changed_bool,
                "change_reason": r.get("change_reason", ""),
                "issue_status_updates": issue_status_updates
            })

    # 争点证明状态的时间线：第一轮看初判，第二轮看变化。
    issue_status_timeline = {
        "round1": [],
        "round2": []
    }
    for i, r in enumerate(reviewer_outputs):
        issue_status_timeline["round1"].append({
            "agent": get_reviewer_type(r, i),
            "issue_proof_status": r.get("issue_proof_status", [])
        })
    for i, r in enumerate(round2_outputs):
        issue_status_timeline["round2"].append({
            "agent": get_reviewer_type(r, i),
            "issue_status_updates": r.get("issue_status_updates", [])
        })

    main_remaining_disagreement = [
        r.get("remaining_disagreement", "")
        for r in round2_outputs
        if r.get("remaining_disagreement", "")
    ]

    def build_final_issue_status(outputs):
        status_order = ["closed", "partly_closed", "open"]
        gap_text = {
            "open": "该争点仍存在关键证明缺口。",
            "partly_closed": "该争点已有一定支持，但证明链条尚未完全闭合。",
            "closed": "该争点目前已形成相对完整的证明支持。"
        }
        issue_records = {}

        for output in outputs:
            for update in output.get("issue_status_updates", []):
                issue = update.get("issue", "")
                if not issue:
                    continue

                issue_records.setdefault(issue, {
                    "statuses": [],
                    "reasons": []
                })

                after_status = update.get("after_status", "")
                if after_status in ["open", "partly_closed", "closed"]:
                    issue_records[issue]["statuses"].append(after_status)

                change_reason = update.get("change_reason", "")
                if change_reason:
                    issue_records[issue]["reasons"].append(change_reason)

        final_issue_status = []
        for issue, record in issue_records.items():
            status_count = {}
            for status in record["statuses"]:
                status_count[status] = status_count.get(status, 0) + 1

            final_status = "open"
            if status_count:
                final_status = max(
                    status_order,
                    key=lambda status: status_count.get(status, 0)
                )

            supporting_reason = "；".join(record["reasons"])
            if not supporting_reason:
                supporting_reason = "第二轮讨论后，该争点仍需结合证据缺口继续判断。"

            final_issue_status.append({
                "issue": issue,
                "final_status": final_status,
                "supporting_reason": supporting_reason,
                "remaining_gap": gap_text[final_status]
            })

        return final_issue_status

    final_issue_status = build_final_issue_status(round2_outputs)

    final_meeting_result = {
        "majority_position": majority_position,
        "is_consensus_reached": is_consensus_reached,
        "main_remaining_disagreement": main_remaining_disagreement,
        "proof_status_summary": "第二轮讨论后，系统记录了各 reviewer 对争点证明状态的更新，仍需重点关注未闭合的证明缺口。",
        "final_issue_status": final_issue_status
    }

    state["deliberation_room"] = {
        "participants": participants,
        "rounds": rounds,
        "vote_history": vote_history,
        "alliance_map": alliance_map,
        "disagreement_map": disagreement_map,
        "state_changes": state_changes,
        "issue_status_timeline": issue_status_timeline,
        "final_meeting_result": final_meeting_result
    }

    state = ForepersonAgent().run(state, logger)
    state = WriterAgent().run(state, logger)

    case_id = state.get("case_id")
    logger.save(f"multi_agent_logs/{case_id}_log.json")
    return state
