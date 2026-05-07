
from src.state_manager import create_state, save_state
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

def run_pipeline(case_id, raw_case_text, user_mode):

    linear_agents = [
        ClerkAgent(),
        IssueSpotterAgent(),
        ProsecutorAgent(),
        DefenseLawyerAgent(),
        DefendantAgent(),
        JudgeAgent()
    ]

    state = create_state(case_id, raw_case_text, user_mode)
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

        round2_input = json.dumps({
            "judge_summary": state["judge_summary"],
            "my_round1_review": my_review,
            "other_round1_reviews": other_reviews
        }, ensure_ascii=False)    

        print(f"[{reviewer.name}_round2] 开始调用 LLM...")
        result = call_llm(round2_prompt, round2_input)
        print(f"[{reviewer.name}_round2] 完成")

        round2_outputs.append(result)
        logger.log(f"{reviewer.name}_round2", {"round": 2}, result)

    state["round2_outputs"] = round2_outputs

    state["reviewer_outputs"] = reviewer_outputs

    state = ForepersonAgent().run(state, logger)
    state = WriterAgent().run(state, logger)

    save_state(state, f"outputs/{case_id}/state_final.json")
    logger.save(f"multi_agent_logs/{case_id}_log.json")
    return state