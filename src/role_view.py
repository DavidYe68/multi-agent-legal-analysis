def get_role_view(state: dict, role: str) -> dict:
    """
    根据 role 返回该 Agent 允许读取的 state 子集。
    目的：防止所有 Agent 都直接读取完整 state。
    """

    role_information = state.get("role_information", {})
    personality_profiles = state.get("personality_profiles", {})

    if role == "clerk":
        return {
            "raw_case_text": state.get("raw_case_text"),
            "public_info": role_information.get("public_info", {})
        }

    if role == "issue_spotter":
        return {
            "case_id": state.get("case_id"),
            "domain_hint": state.get("domain_hint"),
            "case_structured": state.get("case_structured", {})
        }

    if role == "prosecutor":
        return {
            "case_structured": state.get("case_structured", {}),
            "issues": state.get("issues", {}),
            "prosecutor_info": role_information.get("prosecutor_info", {})
        }

    if role == "defense_lawyer":
        return {
            "case_structured": state.get("case_structured", {}),
            "issues": state.get("issues", {}),
            "prosecutor_analysis": state.get("prosecutor_analysis", {}),
            "defense_lawyer_info": role_information.get("defense_lawyer_info", {})
        }

    if role == "defendant":
        return {
            "case_structured": state.get("case_structured", {}),
            "defendant_info": role_information.get("defendant_info", {}),
            "personality_profile": personality_profiles.get("defendant", {})
        }

    if role == "judge":
        return {
            "case_id": state.get("case_id"),
            "issues": state.get("issues", {}),
            "prosecutor_analysis": state.get("prosecutor_analysis", {}),
            "defense_analysis": state.get("defense_analysis", {}),
            "defendant_statement": state.get("defendant_statement", {}),
            "protocol": state.get("protocol", {})
        }

    if any(r in role for r in ["legal", "social", "expert", "public"]):
        for r in ["legal", "social", "expert", "public"]:
            if r in role:
                reviewer_type = r
                break

        profiles = state.get("reviewer_personality_profiles", {})
        personality = profiles.get(f"{reviewer_type}_reviewer", {})
        return {
            "case_structured": state.get("case_structured", {}),
            "issues": state.get("issues", {}),
            "prosecutor_analysis": state.get("prosecutor_analysis", {}),
            "defense_analysis": state.get("defense_analysis", {}),
            "judge_summary": state.get("judge_summary", {}),
            "reviewer_personality": personality
        }
    if role == "foreperson":
        return {
            "judge_summary": state.get("judge_summary", {}),
            "reviewer_outputs": state.get("reviewer_outputs", []),
            "round2_outputs": state.get("round2_outputs", []),
            "deliberation_room": state.get("deliberation_room", {})
        }

    if role == "writer":
        return {
            "case_structured": state.get("case_structured", {}),
            "issues": state.get("issues", {}),
            "judge_summary": state.get("judge_summary", {}),
            "foreperson_summary": state.get("foreperson_summary", {}),
            "user_mode": state.get("user_mode", "teaching")
        }

    return {
        "case_id": state.get("case_id")
    }
