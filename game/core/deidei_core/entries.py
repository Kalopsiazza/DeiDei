"""The fixed R02 entry map and start-of-round qualifications (R02/R09)."""

RULES_VERSION = "classic-1.0.1"
NORMAL_MOVES = (
    "Charge", "Bi", "Def", "Three", "ThreeDef", "BigBi", "Reflect",
    "SelfBi", "Cloud", "Bomb", "Xiao", "Pragon", "PragonDef", "Volvo",
    "VolvoDef", "RotateThree", "XiaoBei", "FlipVolvo", "Shell", "Absorb",
    "NieXiang", "NieXiangDef", "JuYan", "TianLiJun", "ZhangXinWei", "LiQiang",
)
ENTRY_SPECS = tuple(
    (m, "$latest_copyable", "zhang") if m == "ZhangXinWei" else (m, m, "normal")
    for m in NORMAL_MOVES
) + (
    ("BombPragon", "Pragon", "bomb"),
    ("BombVolvo", "Volvo", "bomb"),
    ("BombFlipVolvo", "FlipVolvo", "bomb"),
    ("FreeThree", "Three", "lightning"),
    ("FreeRotateThree", "RotateThree", "lightning"),
    ("ZengYi", "ZengYi", "normal"),
    ("ZengRewardBigBi", "BigBi", "zeng_reward"),
)
ENTRY_MAP = {entry: (move, origin) for entry, move, origin in ENTRY_SPECS}
ACTUAL_MOVES = frozenset(NORMAL_MOVES) - {"ZhangXinWei"} | {"ZengYi"}
COPYABLE_MOVES = frozenset({
    "Pragon", "Three", "Volvo", "BigBi", "RotateThree", "FlipVolvo",
    "NieXiang", "XiaoBei", "Shell",
})
BRANCHES = {"RotateThree": ("Three", "SelfBi"), "FlipVolvo": ("Volvo", "SelfBi")}
ATTACKS = {
    "Xiao": 2, "Bi": 6, "Pragon": 12, "Three": 18, "NieXiang": 21,
    "Volvo": 24, "BigBi": 30, "XiaoBei": 42, "Shell": 60,
}
DD_COSTS = {
    "Bi": 6, "Three": 18, "BigBi": 30, "Reflect": 6, "Bomb": 6,
    "Xiao": 2, "Pragon": 12, "Volvo": 24, "RotateThree": 36,
    "XiaoBei": 42, "FlipVolvo": 48, "Shell": 60, "Absorb": 6,
}
RESOURCES = ("dd6", "lightning", "nx_charge", "mature_bombs", "reward_stock")


def options_for(player: dict, active: bool = True) -> list[dict]:
    """Return integer-valued options; the public API encodes the quantities."""
    options = []
    for index, (entry, move, origin) in enumerate(ENTRY_SPECS, 1):
        required = dict.fromkeys(RESOURCES, 0)
        reason = None
        if origin == "normal":
            required["dd6"] = DD_COSTS.get(entry, 0)
        if entry == "Cloud":
            required["dd6"] = 6 if player["cloud_uses"] else 0
        elif entry == "TianLiJun":
            required["dd6"] = 3 if player["tian_uses"] else 0
        elif entry == "NieXiang":
            required["nx_charge"] = 4
        elif entry == "ZhangXinWei":
            if player["zhang_used"]:
                reason = "ALREADY_USED"
            elif player["latest_copyable_move"] is None:
                reason = "NO_COPY_RECORD"
        elif entry == "LiQiang" and player["liq_used"]:
            reason = "ALREADY_USED"
        elif entry == "ZengYi" and player["zeng_state"] != "unused":
            reason = "ALREADY_USED"
        elif origin == "bomb":
            required["mature_bombs"] = {"Pragon": 1, "Volvo": 2, "FlipVolvo": 4}[move]
        elif origin == "lightning":
            required["lightning"] = 3 if move == "Three" else 6
        elif origin == "zeng_reward":
            required["reward_stock"] = 1
        spend = required.copy()
        if entry == "Xiao" and player["enhanced_xiao"]:
            spend["dd6"] = 0
        for resource, code in zip(RESOURCES, (
            "INSUFFICIENT_DD", "INSUFFICIENT_LIGHTNING", "INSUFFICIENT_CHARGE",
            "INSUFFICIENT_BOMBS", "NO_REWARD",
        )):
            stock = int(player["zeng_state"] == "ready") if resource == "reward_stock" else player[resource]
            if reason is None and stock < required[resource]:
                reason = code
        forced = active and player["zeng_state"] == "recovery"
        if not active:
            reason = "NOT_ACTIVE"
        elif forced:
            reason = "FORCED_RECOVERY"
        options.append({
            "entry_id": entry, "doc_id": f"E{index:02d}", "available": reason is None,
            "reason_code": reason, "required": required, "spend": spend, "forced": forced,
        })
    return options
