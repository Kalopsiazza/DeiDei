"""Check supplied branch score tables, without simulating DeiDei combat.

The abstract tables describe selection boundaries, not new moves or rules.
Run from the repository root; stdout is deterministic JSON evidence.
"""

from itertools import product
import json


DEAD0, DEAD2, DEAD4 = (0, 0), (0, 2), (0, 4)
LIVE0, LIVE1, LIVE2 = (1, 0), (1, 1), (1, 2)

# Profiles follow product order; 0/1 mean abstract alternatives except K01/K02/K10.
CASES = {
    "K00_no_selector": ((), [()], [()]),
    "K01_unique": ((2, 2), [
        (LIVE0, LIVE0), (LIVE0, LIVE1),
        (LIVE1, LIVE0), (LIVE1, LIVE1),
    ], [(1, 1)]),
    "K02_all_tied": ((2, 2), [(LIVE1, LIVE1)] * 4,
                     [(0, 0), (0, 1), (1, 0), (1, 1)]),
    "K03_coordinated_tie": ((2, 2), [
        (LIVE1, LIVE1), (DEAD0, DEAD0),
        (DEAD0, DEAD0), (LIVE1, LIVE1),
    ], [(0, 0), (1, 1)]),
    "K04_joint_improvement": ((2, 2), [
        (LIVE1, LIVE1), (DEAD0, DEAD0),
        (DEAD0, DEAD0), (LIVE2, LIVE2),
    ], [(0, 0), (1, 1)]),
    "K05_conflicting_preferences": ((2, 2), [
        (LIVE2, LIVE1), (DEAD0, DEAD0),
        (DEAD0, DEAD0), (LIVE1, LIVE2),
    ], [(0, 0), (1, 1)]),
    "K06_no_stable_profile": ((2, 2), [
        (LIVE1, DEAD0), (DEAD0, LIVE1),
        (DEAD0, LIVE1), (LIVE1, DEAD0),
    ], []),
    "K07_local_tie_escape": ((2, 2), [
        (LIVE1, LIVE1), (LIVE2, LIVE0),
        (LIVE1, LIVE0), (LIVE0, LIVE1),
    ], [(0, 0)]),
    "K08_all_dead_more_kills": ((2,), [(DEAD2,), (DEAD4,)], [(1,)]),
    "K09_all_dead_tie": ((2,), [(DEAD2,), (DEAD2,)], [(0,), (1,)]),
    "K10_three_selectors": ((2, 2, 2), [
        tuple((1, branch) for branch in profile)
        for profile in product(range(2), repeat=3)
    ], [(1, 1, 1)]),
    "K11_three_tied_profiles": ((2, 2), [
        (LIVE1, LIVE1), (LIVE1, LIVE1),
        (LIVE1, LIVE1), (DEAD0, DEAD0),
    ], [(0, 0), (0, 1), (1, 0)]),
    "K12_survival_first": ((2,), [(LIVE0,), (DEAD4,)], [(0,)]),
}


def analyze(counts: tuple[int, ...], rows: list) -> dict:
    """Enumerate unilateral strict improvements in a complete supplied table."""
    if any(type(count) is not int or count < 1 for count in counts):
        raise ValueError("Each selector must have at least one candidate")
    profiles = list(product(*(range(count) for count in counts)))
    if len(rows) != len(profiles):
        raise ValueError("Incomplete score table is not a no-stable-profile case")
    for row in rows:
        if row is None or len(row) != len(counts):
            raise ValueError("Unknown scores must be resolved before filtering")
        for alive, kills in row:
            if alive not in (0, 1) or type(kills) is not int or kills < 0:
                raise ValueError("Expected survival flag and nonnegative kill count")
    table = dict(zip(profiles, rows))
    checks = []
    stable = []
    # ponytail: full enumeration is enough for these small, explicit discussion tables.
    for profile in profiles:
        improvements = []
        for actor, count in enumerate(counts):
            for alternative in range(count):
                changed = profile[:actor] + (alternative,) + profile[actor + 1:]
                if table[changed][actor] > table[profile][actor]:
                    improvements.append({"actor": actor, "alternative": alternative,
                                         "better_score": table[changed][actor]})
        checks.append({"profile": profile, "scores": table[profile],
                       "strict_improvements": improvements})
        if not improvements:
            stable.append(profile)
    nondominated = [profile for profile in stable if not any(
        all(a >= b for a, b in zip(table[other], table[profile]))
        and any(a > b for a, b in zip(table[other], table[profile]))
        for other in stable
    )]
    return {"profiles": checks, "stable": stable,
            "nondominated_stable": nondominated}


def main() -> None:
    results = {}
    for name, (counts, rows, expected) in CASES.items():
        result = analyze(counts, rows)
        assert result["stable"] == expected, name
        results[name] = result
    assert results["K04_joint_improvement"]["nondominated_stable"] == [(1, 1)]
    assert results["K05_conflicting_preferences"]["nondominated_stable"] == [(0, 0), (1, 1)]
    for bad_rows in [[(LIVE0,)], [(LIVE0,), None]]:
        try:
            analyze((2,), bad_rows)
        except ValueError:
            pass
        else:
            raise AssertionError("An incomplete/unknown table was accepted")
    print(json.dumps({
        "scope": "Score-table analysis only; no game engine, AI, randomness or resource updates",
        "passed_tables": len(results), "rejected_incomplete_or_unknown_tables": 2,
        "results": results,
    }, ensure_ascii=False, indent=2) + "\n", end="")


if __name__ == "__main__":
    main()
