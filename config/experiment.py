EXPERIMENTS = {
    "baseline": {"mode": "baseline"},
    "linear": {"mode": "linear"},
    "full":   {"mode": "full"},
}

COMPONENT = {
    "no_role_separate": {"mode": "full", "role_separation": False},
    "no_round2": {"mode": "full", "enable_round2": False},
    "no_adversarial": {"mode": "full", "adversarial_exchange": False},
    "no_proofstate": {"mode": "full", "proof_state": False},
}

DEFAULT = {
    "mode": "full",
    "role_separation": True,
    "enable_round2": True,
    "adversarial_exchange": True,
    "proof_state": True,
}

def get_config(name):
    if name in EXPERIMENTS:
        setting = EXPERIMENTS[name]
    else:
        setting = COMPONENT[name]
    config = dict(DEFAULT)
    config.update(setting)
    config["name"] = name
    return config
