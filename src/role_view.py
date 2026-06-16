def pick_by_ids(index, ids):
    result = []
    for item_id in ids:
        result.append(index[item_id])
    return result

def get_role_view(state, role):
    reviewer_roles = ["legal_reviewer_round1", "social_reviewer_round1", "expert_reviewer_round1", "public_reviewer_round1"]
    if "reviewer" in role:
        role_name = "reviewers"
    else:
        role_name = role

    rule = state["role_views"][role_name]

    facts = pick_by_ids(state["fact_index"], rule["fact_ids"])
    claims = pick_by_ids(state["claim_index"], rule["claim_ids"])
    evidence = pick_by_ids(state["evidence_index"], rule["evidence_ids"])

    procedure = {}
    if rule["procedure_access"]:
        procedure = state["procedure"]

    case_structured = {
        "case_narrative": state["case_narrative"],
        "participants": state["participants"],
        "facts": facts,
        "claims": claims,
        "evidence": evidence,
        "procedure": procedure
    }

    view = {
        "case_id": state["case_id"],
        "task_mode": state["task_mode"],
        "domain": state["domain"],
        "case_narrative": state["case_narrative"],
        "participants": state["participants"],
        "facts": facts,
        "claims": claims,
        "evidence": evidence,
        "procedure": procedure,
        "role_view_notes": rule["notes"],
        "case_structured": case_structured
    }

    if role == "clerk":
        return view

    if role == "issue_spotter":
        return view

    if role == "prosecutor":
        view["issues"] = state.get("issues", {})
        return view

    if role == "defense_lawyer":
        view["issues"] = state.get("issues", {})
        view["prosecutor_analysis"] = state.get("prosecutor_analysis", {})
        return view

    if role == "defendant":
        view["personality_profile"] = {}
        return view

    if role == "judge":
        view["issues"] = state.get("issues", {})
        view["prosecutor_analysis"] = state.get("prosecutor_analysis", {})
        view["defense_analysis"] = state.get("defense_analysis", {})
        view["defendant_statement"] = state.get("defendant_statement", {})
        view["protocol"] = state["procedure"]
        return view

    if role_name == "reviewers":
        reviewer_type = ""
        if "legal" in role:
            reviewer_type = "legal"
        elif "social" in role:
            reviewer_type = "social"
        elif "expert" in role:
            reviewer_type = "expert"
        elif "public" in role:
            reviewer_type = "public"

        view["reviewer_type"] = reviewer_type
        view["issues"] = state.get("issues", {})
        view["prosecutor_analysis"] = state.get("prosecutor_analysis", {})
        view["defense_analysis"] = state.get("defense_analysis", {})
        view["defendant_statement"] = state.get("defendant_statement", {})
        view["judge_summary"] = state.get("judge_summary", {})
        view["reviewer_personality"] = {}
        return view

    if role == "foreperson":
        view["judge_summary"] = state.get("judge_summary", {})
        view["reviewer_outputs"] = state.get("reviewer_outputs", [])
        view["round2_outputs"] = state.get("round2_outputs", [])
        view["deliberation_room"] = state.get("deliberation_room", {})
        return view

    if role == "writer":
        view["issues"] = state.get("issues", {})
        view["prosecutor_analysis"] = state.get("prosecutor_analysis", {})
        view["defense_analysis"] = state.get("defense_analysis", {})
        view["defendant_statement"] = state.get("defendant_statement", {})
        view["judge_summary"] = state.get("judge_summary", {})
        view["foreperson_summary"] = state.get("foreperson_summary", {})
        view["deliberation_room"] = state.get("deliberation_room", {})
        return view

    return {
        "case_id": state["case_id"]
    }
