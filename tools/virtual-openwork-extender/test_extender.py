import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("extender", Path(__file__).with_name("extender.py"))
extender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extender)

TARGET = json.dumps({"denWeb": "https://app.example.com", "denApi": "https://api.example.com", "workbot": "http://localhost:3020", "organizationId": "org_test"})


class ExtenderTests(unittest.TestCase):
    def test_both_cli_record_shapes(self):
        records = [{"secretKey": "VOE_GOOGLE_EMAIL", "secretValue": "demo@example.com"}, {"key": "VOE_GOOGLE_PASSWORD", "value": "dummy"}, {"key": "UNRELATED_TOKEN", "value": "do-not-import"}]
        with patch.object(extender, "cli", return_value=json.dumps(records)):
            self.assertEqual(extender.load(), {"VOE_GOOGLE_EMAIL": "demo@example.com", "VOE_GOOGLE_PASSWORD": "dummy"})

    def test_empty_folder(self):
        with patch.object(extender, "cli", return_value="null"):
            self.assertEqual(extender.load(), {})

    def test_unresolved_reference_is_not_present(self):
        with patch.object(extender, "cli", return_value='[{"key":"VOE_GOOGLE_PASSWORD","value":"${missing}"}]'):
            self.assertEqual(extender.load(), {})

    def test_inventory_never_claims_recording_ready(self):
        values = {key: "dummy" for key in extender.KEYS}
        values["VOE_TARGET_JSON"] = TARGET
        report = extender.inventory(values)
        self.assertFalse(report["readyToRecord"])
        self.assertEqual(report["connections"], {"google": "not_tested", "slack": "not_tested"})
        self.assertNotIn("dummy", json.dumps(report))

    def test_target_rejects_embedded_secrets_and_noncanonical_origins(self):
        for origin in ["https://user:pass@example.com", "https://example.com/?token=secret", "http://example.com", "https://example.com/path", "https://example.com/#secret"]:
            target = json.loads(TARGET)
            target["denApi"] = origin
            with self.assertRaises(extender.SetupError):
                extender.validate_target(json.dumps(target))

    def test_target_allows_https_or_loopback_http(self):
        self.assertEqual(extender.validate_target(TARGET)["organizationId"], "org_test")

    def test_save_does_not_overwrite(self):
        with patch.object(extender, "load", return_value={"VOE_GOOGLE_PASSWORD": "old"}), patch.object(extender, "cli") as cli:
            with self.assertRaises(extender.SetupError):
                extender.save("VOE_GOOGLE_PASSWORD", "new")
            cli.assert_not_called()

    def test_save_uses_stdin_yaml_and_readback(self):
        value = "dummy'\"\\\n$secret"
        with patch.object(extender, "load", side_effect=[{}, {"VOE_GOOGLE_PASSWORD": value}]), patch.object(extender, "cli") as cli:
            extender.save("VOE_GOOGLE_PASSWORD", value)
            args, payload = cli.call_args.args
            self.assertNotIn(value, " ".join(args))
            self.assertTrue(args[args.index("--file") + 1].endswith(".yaml"))
            self.assertEqual(json.loads(payload), {"VOE_GOOGLE_PASSWORD": value})

    def test_failed_readback_does_not_retry(self):
        with patch.object(extender, "load", side_effect=[{}, {}]), patch.object(extender, "cli") as cli:
            with self.assertRaises(extender.SetupError):
                extender.save("VOE_GOOGLE_PASSWORD", "dummy")
            self.assertEqual(cli.call_count, 1)

    def test_provider_error_is_sanitized(self):
        result = subprocess.CompletedProcess([], 1, "secret-value", "secret-value")
        with patch.object(extender.subprocess, "run", return_value=result):
            with self.assertRaises(extender.SetupError) as error:
                extender.cli(["secrets"])
            self.assertNotIn("secret-value", str(error.exception))

    def test_run_is_scoped_and_redacts_values(self):
        values = {"VOE_" + key: "dummy-" + key for key in extender.MODULES["google"]}
        values["VOE_SLACK_CLIENT_SECRET"] = "other-module"
        result = subprocess.CompletedProcess([], 0, values["VOE_GOOGLE_PASSWORD"], values["VOE_GOOGLE_EMAIL"])
        out, err = io.StringIO(), io.StringIO()
        with patch.object(extender.subprocess, "run", return_value=result) as child, contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            self.assertEqual(extender.run("google", ["python3", "trusted.py"], values), 0)
        env = child.call_args.kwargs["env"]
        self.assertNotIn("VOE_SLACK_CLIENT_SECRET", env)
        self.assertEqual(out.getvalue(), "[REDACTED]")
        self.assertEqual(err.getvalue(), "[REDACTED]")

    def test_missing_keys_prevent_child_start(self):
        with patch.object(extender.subprocess, "run") as child:
            with self.assertRaises(extender.SetupError):
                extender.run("google", ["python3", "trusted.py"], {})
            child.assert_not_called()


if __name__ == "__main__":
    unittest.main()
