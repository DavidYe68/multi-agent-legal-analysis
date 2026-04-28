
from src.state_manager import create_state, save_state
from src.logger import Logger

from src.agents.clerk import ClerkAgent
from src.agents.issue_spotter import IssueSpotterAgent
from src.agents.plaintiff import PlaintiffAgent
from src.agents.defendant import DefendantAgent
from src.agents.judge import JudgeAgent
from src.agents.reviewer import ReviewerAgent
from src.agents.foreperson import ForepersonAgent
from src.agents.writer import WriterAgent

def run_pipeline(case_id, raw_case_text):

    linear_agents = [
        ClerkAgent(),
        IssueSpotterAgent(),
        PlaintiffAgent(),
        DefendantAgent(),
        JudgeAgent()
    ]

    state = create_state(case_id, raw_case_text)
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

    state["reviewer_outputs"] = reviewer_outputs

    state = ForepersonAgent().run(state, logger)
    state = WriterAgent().run(state, logger)

    save_state(state, f"outputs/{case_id}/state_final.json")
    logger.save(f"multi_agent_logs/{case_id}_log.json")
    return state