
from src.state_manager import create_state
from src.baseline import run_baseline
from src.logger import Logger

from src.agents.clerk import ClerkAgent
from src.agents.issue_spotter import IssueSpotterAgent
from src.agents.prosecutor import ProsecutorAgent
from src.agents.defense_lawyer import DefenseLawyerAgent
from src.agents.defendant import DefendantAgent
from src.agents.judge import JudgeAgent
from src.agents.round1 import Round1ReviewerAgent
from src.agents.round2 import Round2ReviewerAgent
from src.agents.foreperson import ForepersonAgent
from src.agents.writer import WriterAgent


REVIEWERS = ["legal", "social", "expert", "public"]

def run_pipeline(case_data, config):
    if config["mode"] == "baseline":
        return run_baseline(case_data, config)

    state = create_state(case_data, config)
    logger = Logger(state.get("case_id", ""))

    state = run_linear_trial(state, logger)

    if config["mode"] == "linear":
        state["reviewer_outputs"] = []
        state["round2_outputs"] = []
        state["deliberation_room"] = {}
        state = run_summary(state, logger)
        case_id = state.get("case_id")
        logger.save(f"multi_agent_logs/{config['name']}/{case_id}_log.json")
        return state

    round1_reviews = run_round1(state, logger)

    if config["enable_round2"]:
        round2_reviews = run_round2(state, round1_reviews, logger, config)
    else:
        round2_reviews = []

    state["reviewer_outputs"] = round1_reviews
    state["round2_outputs"] = round2_reviews
    state["deliberation_room"] = build_deliberation_room(round1_reviews, round2_reviews, state.get("issues", {}), config)

    state = run_summary(state, logger)

    case_id = state.get("case_id")
    logger.save(f"multi_agent_logs/{config['name']}/{case_id}_log.json")
    return state

def run_linear_trial(state, logger):
    linear_agents = [
        ClerkAgent(),
        IssueSpotterAgent(),
        ProsecutorAgent(),
        DefenseLawyerAgent(),
        DefendantAgent(),
        JudgeAgent()
    ]
    for agent in linear_agents:
        state = agent.run(state, logger)
    return state

def run_round1(state, logger):
    round1_reviews = []
    for role in REVIEWERS:
        reviewer = Round1ReviewerAgent(role)
        state = reviewer.run(state, logger)
        round1_reviews.append(state["current_round1_review"])
    return round1_reviews


def run_round2(state, round1_reviews, logger, config):
    round2_reviews = []

    for i, role in enumerate(REVIEWERS):
        my_review = round1_reviews[i]
        other_reviews = []
        reviewer = Round2ReviewerAgent(role)

        if config["adversarial_exchange"]:
            for j, review in enumerate(round1_reviews):
                if i != j:
                    other_reviews.append(review)

        state = reviewer.run(state, logger, my_round1_review=my_review, other_round1_reviews=other_reviews)
        round2_reviews.append(state["current_round2_review"])

    return round2_reviews

def build_alliance_map(round1_reviews, round2_reviews):
    alliance_map = {}

    for i, role in enumerate(REVIEWERS):
        allies = []
        opponents = []

        my_round1 = round1_reviews[i]
        my_round2 = round2_reviews[i]
        my_name = f"{role}_reviewer"
        prev_stand = my_round1.get("position", "unclear")
        curr_stand = my_round2.get("position_after", "unclear")

        for j, other_role in enumerate(REVIEWERS):
            if i == j:
                continue

            other_name = f"{other_role}_reviewer"
            other_round2 = round2_reviews[j]
            other_curr_stand = other_round2.get("position_after", "unclear")

            if curr_stand == other_curr_stand:
                allies.append(other_name)
            else:
                opponents.append(other_name)

        alliance_map[my_name] = {
            "position_before": prev_stand,
            "position_after": curr_stand,
            "position_changed": prev_stand != curr_stand,
            "allies": allies,
            "opponents": opponents
        }

    return alliance_map


def build_vote_history(round1_reviews, round2_reviews):
    vote_history = {
        "round1": {},
        "round2": {}
    }

    for review in round1_reviews:
        position = review.get("position", "unclear")
        vote_history["round1"][position] = vote_history["round1"].get(position, 0) + 1

    for review in round2_reviews:
        position = review.get("position_after", "unclear")
        vote_history["round2"][position] = vote_history["round2"].get(position, 0) + 1

    return vote_history


def build_issue_status_timeline(round1_reviews, round2_reviews):
    timeline = []
    for review in round1_reviews:
        agent_id = review.get("agent_id", "")
        for item in review.get("issue_proof_status", []):
            timeline.append({
                "round_id": 1,
                "agent_id": agent_id,
                "issue_id": item.get("issue_id", ""),
                "status": item.get("status", ""),
                "reason": item.get("reason", "")
            })

    for review in round2_reviews:
        agent_id = review.get("agent_id", "")
        for item in review.get("issue_status_updates", []):
            timeline.append({
                "round_id": 2,
                "agent_id": agent_id,
                "issue_id": item.get("issue_id", ""),
                "status": item.get("after_status", ""),
                "reason": item.get("change_reason", "")
            })

    return timeline

def choose_final_status(statuses):
    if "open" in statuses:
        return "open"
    if "partly_closed" in statuses:
        return "partly_closed"
    if "closed" in statuses:
        return "closed"
    return "open"

def build_final_issue_status(round1_reviews, round2_reviews, issues):
    issue_text_map = {}
    for item in issues.get("issues", []):
        issue_text_map[item.get("issue_id", "")] = item.get("issue_text", "")

    issue_rows = {}

    for review in round1_reviews:
        for item in review.get("issue_proof_status", []):
            issue_id = item.get("issue_id", "")
            if not issue_id:
                continue
            if issue_id not in issue_rows:
                issue_rows[issue_id] = {"statuses": [], "reasons": [], "gaps": []}
            issue_rows[issue_id]["statuses"].append(item.get("status", ""))
            if item.get("reason"):
                issue_rows[issue_id]["reasons"].append(item.get("reason"))

    for review in round2_reviews:
        for item in review.get("issue_status_updates", []):
            issue_id = item.get("issue_id", "")
            if not issue_id:
                continue
            if issue_id not in issue_rows:
                issue_rows[issue_id] = {"statuses": [], "reasons": [], "gaps": []}
            issue_rows[issue_id]["statuses"].append(item.get("after_status", ""))
            if item.get("change_reason"):
                issue_rows[issue_id]["reasons"].append(item.get("change_reason"))
            if item.get("after_status") == "open" and item.get("change_reason"):
                issue_rows[issue_id]["gaps"].append(item.get("change_reason"))

    final_rows = []
    for issue_id, data in issue_rows.items():
        final_status = choose_final_status(data["statuses"])
        remaining_gap = "；".join(data["gaps"])
        if not remaining_gap and final_status == "open":
            remaining_gap = "该争点仍存在证明缺口。"

        issue_text = issue_text_map.get(issue_id, issue_id)
        final_rows.append({
            "issue_id": issue_id,
            "issue": issue_text,
            "issue_text": issue_text,
            "final_status": final_status,
            "supporting_reason": "；".join(data["reasons"]),
            "remaining_gap": remaining_gap
        })

    return final_rows

def build_disagreement_map(round2_reviews):
    disagreement_map = []
    for review in round2_reviews:
        agent_id = review.get("agent_id", "")
        for item in review.get("respond_to", []):
            disagreement_map.append({
                "agent_id": agent_id,
                "target_agent": item.get("target_agent", ""),
                "relation": item.get("relation", ""),
                "issue_id": item.get("issue_id", ""),
                "response_reason": item.get("response_reason", "")
            })
    return disagreement_map

def build_state_changes(round2_reviews):
    state_changes = []
    for review in round2_reviews:
        if review.get("position_changed"):
            state_changes.append({
                "agent_id": review.get("agent_id", ""),
                "change_type": "position",
                "before": review.get("position_before", ""),
                "after": review.get("position_after", ""),
                "reason": review.get("change_reason", "")
            })

        for item in review.get("issue_status_updates", []):
            if item.get("before_status") != item.get("after_status"):
                state_changes.append({
                    "agent_id": review.get("agent_id", ""),
                    "change_type": "issue_status",
                    "issue_id": item.get("issue_id", ""),
                    "before": item.get("before_status", ""),
                    "after": item.get("after_status", ""),
                    "reason": item.get("change_reason", "")
                })
    return state_changes


def build_deliberation_room(round1_reviews, round2_reviews, issues, config):
    if config["enable_round2"]:
        alliance_map = build_alliance_map(round1_reviews, round2_reviews)
    else:
        alliance_map = {}

    if config["proof_state"]:
        final_issue_status = build_final_issue_status(round1_reviews, round2_reviews, issues)
    else:
        final_issue_status = []

    deliberation_room = {
        "participants": ["legal_reviewer", "social_reviewer", "expert_reviewer", "public_reviewer"],
        "rounds": [
            {
                "round_id": 1, 
                "round_type": "opening_statement", 
                "speeches": round1_reviews
             },
            {
                "round_id": 2, 
                "round_type": "response", 
                "speeches": round2_reviews
            }
        ],
        "vote_history": build_vote_history(round1_reviews, round2_reviews),
        "alliance_map": alliance_map,
        "disagreement_map": build_disagreement_map(round2_reviews),
        "state_changes": build_state_changes(round2_reviews),
        "issue_status_timeline": build_issue_status_timeline(round1_reviews, round2_reviews),
        "final_meeting_result": {
            "final_issue_status": final_issue_status
        }
    }
    return deliberation_room

def run_summary(state, logger):
    state = ForepersonAgent().run(state, logger)
    state = WriterAgent().run(state, logger)
    return state