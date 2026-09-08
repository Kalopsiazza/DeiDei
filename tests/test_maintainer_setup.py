"""Verify safety checks without contacting GitHub or modifying settings."""
from copy import deepcopy
from contextlib import redirect_stdout, redirect_stderr
import io
import unittest
from unittest.mock import patch

from scripts import configure_github as setup


def example_response():
    payload = setup.protection_payload(123)
    for key in ("enforce_admins", "required_linear_history", "allow_force_pushes",
                "allow_deletions", "required_conversation_resolution"):
        payload[key] = {"enabled": payload[key]}
    return payload


class ConfigurationTests(unittest.TestCase):
    def test_single_maintainer_does_not_need_another_approver(self):
        reviews = setup.protection_payload(123)["required_pull_request_reviews"]
        self.assertEqual(reviews["required_approving_review_count"], 0)
        self.assertFalse(reviews["require_code_owner_reviews"])
        self.assertFalse(reviews["require_last_push_approval"])

    def test_admins_are_protected_and_force_push_is_disabled(self):
        payload = setup.protection_payload(123)
        self.assertTrue(payload["enforce_admins"])
        self.assertFalse(payload["allow_force_pushes"])
        self.assertFalse(payload["allow_deletions"])
        self.assertEqual(payload["required_status_checks"]["checks"][0]["app_id"], 123)

    def test_readback_accepts_expected_settings(self):
        setup.verify(deepcopy(setup.REPO_SETTINGS), example_response(), 123)

    def test_readback_rejects_different_app(self):
        with self.assertRaises(RuntimeError):
            setup.verify(deepcopy(setup.REPO_SETTINGS), example_response(), 999)

    def test_readback_rejects_missing_pr_requirement(self):
        response = example_response()
        response.pop("required_pull_request_reviews")
        with self.assertRaises(RuntimeError):
            setup.verify(deepcopy(setup.REPO_SETTINGS), response, 123)

    def test_existing_protection_stops_before_any_write(self):
        responses = [
            {"full_name": setup.REPO, "default_branch": "main", "permissions": {"admin": True}},
            {"protected": True},
        ]
        with patch.object(setup, "api", side_effect=responses) as fake_api, \
             patch.object(setup.shutil, "which", return_value="gh"), \
             patch.object(setup.sys, "argv", ["configure_github.py", "--apply"]), \
             redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(setup.main(), 1)
        self.assertEqual(fake_api.call_count, 2)
        self.assertTrue(all(len(call.args) == 1 for call in fake_api.call_args_list))

    def test_preview_performs_reads_only(self):
        responses = [
            {"full_name": setup.REPO, "default_branch": "main", "permissions": {"admin": True}},
            {"protected": False, "commit": {"sha": "example-head"}},
            [],
            {"check_runs": [{"id": 1, "name": "core-tests", "head_sha": "example-head",
                             "status": "completed", "conclusion": "success",
                             "app": {"slug": "github-actions", "id": 123}}]},
        ]
        with patch.object(setup, "api", side_effect=responses) as fake_api, \
             patch.object(setup.shutil, "which", return_value="gh"), \
             patch.object(setup.sys, "argv", ["configure_github.py"]), \
             redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(setup.main(), 0)
        self.assertEqual(fake_api.call_count, 4)
        self.assertTrue(all(len(call.args) == 1 for call in fake_api.call_args_list))


if __name__ == "__main__":
    unittest.main()
