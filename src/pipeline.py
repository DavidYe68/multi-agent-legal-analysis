
from src.state_manager import create_state
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

def run_pipeline(case_data):
    state = create_state(case_data)
    logger = Logger()

    state = run_linear_trial(state, logger)

    round1_reviews = run_round1(state, logger)
    round2_reviews = run_round2(state, round1_reviews, logger)

    state["reviewer_outputs"] = round1_reviews
    state["round2_outputs"] = round2_reviews
    state["deliberation_room"] = build_deliberation_room(round1_reviews, round2_reviews)

    state = run_summary(state, logger)

    case_id = state.get("case_id")
    logger.save(f"multi_agent_logs/{case_id}_log.json")
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


def run_round2(state, round1_reviews, logger):
    round2_reviews = []

    for i, role in enumerate(REVIEWERS):
        my_review = round1_reviews[i]
        other_reviews = []
        reviewer = Round2ReviewerAgent(role)

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


def build_deliberation_room(round1_reviews, round2_reviews):
    alliance_map = build_alliance_map(round1_reviews, round2_reviews)

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
        "alliance_map": alliance_map
    }
    return deliberation_room

def run_summary(state, logger):
    state = ForepersonAgent().run(state, logger)
    state = WriterAgent().run(state, logger)
    return state