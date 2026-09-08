"""Preview or apply the one-time settings for Kalopsiazza/DeiDei.

Uses an existing `gh` login. No tokens are accepted or printed. Refuses to
replace existing branch protection or active rulesets. Run manually only.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys

REPO = "Kalopsiazza/DeiDei"
PREFIX = f"repos/{REPO}"
REPO_SETTINGS = {
    "allow_squash_merge": True,
    "allow_merge_commit": False,
    "allow_rebase_merge": False,
    "allow_auto_merge": False,
    "delete_branch_on_merge": True,
}


def api(path: str, method: str = "GET", data: dict | None = None) -> object:
    cmd = ["gh", "api", "--hostname", "github.com", "--method", method,
           "-H", "Accept: application/vnd.github+json", path]
    if data is not None:
        cmd += ["--input", "-"]
    result = subprocess.run(
        cmd, input=json.dumps(data) if data is not None else None,
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode:
        raise RuntimeError(f"GitHub request failed: {method} {path}\n{result.stderr.strip()}")
    return json.loads(result.stdout) if result.stdout.strip() else {}


def protection_payload(app_id: int) -> dict:
    return {
        "required_status_checks": {
            "strict": True, "contexts": [],
            "checks": [{"context": "core-tests", "app_id": app_id}],
        },
        "enforce_admins": True,
        "required_pull_request_reviews": {
            "dismiss_stale_reviews": True,
            "require_code_owner_reviews": False,
            "required_approving_review_count": 0,
            "require_last_push_approval": False,
        },
        "restrictions": None,
        "required_linear_history": True,
        "allow_force_pushes": False,
        "allow_deletions": False,
        "required_conversation_resolution": True,
    }


def verify(repo: dict, protection: dict, app_id: int) -> None:
    for key, wanted in REPO_SETTINGS.items():
        if repo.get(key) != wanted:
            raise RuntimeError(f"Repository setting verification failed: {key}")
    flags = {
        "enforce_admins": True, "required_linear_history": True,
        "allow_force_pushes": False, "allow_deletions": False,
        "required_conversation_resolution": True,
    }
    for key, wanted in flags.items():
        if protection.get(key, {}).get("enabled") != wanted:
            raise RuntimeError(f"Branch setting verification failed: {key}")
    checks = protection.get("required_status_checks", {})
    if not checks.get("strict") or not any(
        c.get("context") == "core-tests" and c.get("app_id") == app_id
        for c in checks.get("checks", [])
    ):
        raise RuntimeError("Required core-tests check verification failed")
    reviews = protection.get("required_pull_request_reviews")
    if not isinstance(reviews, dict) or reviews.get("required_approving_review_count") != 0:
        raise RuntimeError("Pull request requirement verification failed")
    if not reviews.get("dismiss_stale_reviews"):
        raise RuntimeError("Stale review setting verification failed")
    if reviews.get("require_code_owner_reviews") or reviews.get("require_last_push_approval"):
        raise RuntimeError("Single-maintainer review settings are not as requested")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write settings after preflight checks")
    args = parser.parse_args()
    phase = "preflight (no writes)"
    try:
        if not shutil.which("gh"):
            raise RuntimeError("GitHub CLI (gh) is not installed; use an authenticated maintainer environment.")
        repo = api(PREFIX)
        if repo.get("full_name") != REPO or repo.get("default_branch") != "main":
            raise RuntimeError("Unexpected repository or default branch; stopping.")
        if not repo.get("permissions", {}).get("admin"):
            raise RuntimeError("The existing gh login does not have repository administration permission.")
        branch = api(f"{PREFIX}/branches/main")
        if branch.get("protected"):
            raise RuntimeError("main already has protection. Inspect existing rules; this script will not replace them.")
        rulesets = api(f"{PREFIX}/rulesets?includes_parents=true&per_page=100")
        if len(rulesets) >= 100 or any(r.get("enforcement") == "active" for r in rulesets):
            raise RuntimeError("Existing rulesets need manual review; no settings were changed.")
        sha = branch["commit"]["sha"]
        runs = api(f"{PREFIX}/commits/{sha}/check-runs?per_page=100")
        matching = [c for c in runs.get("check_runs", [])
                    if c.get("name") == "core-tests" and c.get("app", {}).get("slug") == "github-actions"
                    and c.get("head_sha") == sha]
        if not matching:
            raise RuntimeError("No GitHub Actions core-tests check was found for current main.")
        latest = max(matching, key=lambda c: c["id"])
        if latest.get("status") != "completed" or latest.get("conclusion") != "success":
            raise RuntimeError("The latest core-tests run on current main has not succeeded.")
        app_id = int(latest["app"]["id"])
        payload = protection_payload(app_id)
        print(json.dumps({"repository": REPO, "checked_main": sha,
                          "repository_settings": REPO_SETTINGS, "main_protection": payload}, indent=2))
        if not args.apply:
            print("Preview only: no settings changed. Run with --apply to write.")
            return 0
        current = api(f"{PREFIX}/branches/main")
        if current["commit"]["sha"] != sha or current.get("protected"):
            raise RuntimeError("main changed during preflight; run the preview again.")
        phase = "repository settings PATCH"
        api(PREFIX, "PATCH", REPO_SETTINGS)
        phase = "branch protection PUT (repository settings already written)"
        api(f"{PREFIX}/branches/main/protection", "PUT", payload)
        phase = "read-back verification (writes completed)"
        saved_repo = api(PREFIX)
        saved_protection = api(f"{PREFIX}/branches/main/protection")
        verify(saved_repo, saved_protection, app_id)
        print("Verified: repository merge settings and main branch protection applied.")
        print("Record this result in docs/maintainer-setup.md through a separate PR.")
        return 0
    except (RuntimeError, OSError, subprocess.TimeoutExpired, ValueError, KeyError, TypeError) as exc:
        print(f"STOPPED during {phase}: {exc}", file=sys.stderr)
        print("Do not assume completion. Read current settings before retrying; no automatic rollback was attempted.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
