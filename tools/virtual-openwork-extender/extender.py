#!/usr/bin/env python3
"""Read demo credentials just in time; never print or persist their values."""
import argparse
import json
import os
import re
import subprocess
import sys

PROJECT = "e9f4542a-8714-46c3-a8fd-99d8cb370aeb"
FOLDER = "/openwork-ops/virtual-openwork-extender"
MODULES = {
    "google": ["GOOGLE_EMAIL", "GOOGLE_PASSWORD", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
    "slack": ["SLACK_WORKSPACE_URL", "SLACK_APP_ID", "SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_SIGNING_SECRET"],
    "target": ["TARGET_JSON"],
}
OPTIONAL = ["GOOGLE_PROJECT_ID", "GOOGLE_REFRESH_TOKEN", "SLACK_CONNECTION_ID", "SEED_RECEIPT_JSON"]
KEYS = {"VOE_" + key for group in MODULES.values() for key in group} | {"VOE_" + key for key in OPTIONAL}


class SetupError(Exception):
    pass


def cli(args, payload=None):
    try:
        result = subprocess.run(
            ["infisical", *args, "--projectId", PROJECT, "--env", "dev", "--path", FOLDER, "--silent"],
            input=payload, text=True, capture_output=True, timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise SetupError("Infisical unavailable; check CLI installation and sign-in.") from None
    if result.returncode:
        # Provider errors may contain values. Do not echo their raw output.
        raise SetupError("Infisical operation failed; check access to the project, dev environment and folder.")
    return result.stdout


def load():
    try:
        records = json.loads(cli(["secrets", "--output", "json"])) or []
        if not isinstance(records, list):
            raise ValueError()
        values = {}
        for record in records:
            key = record.get("key", record.get("secretKey"))
            value = record.get("value", record.get("secretValue"))
            if key in KEYS and isinstance(value, str) and value and not value.startswith("${"):
                values[key] = value
        return values
    except (ValueError, TypeError, AttributeError):
        raise SetupError("Unexpected Infisical response; content withheld.") from None


def validate_target(raw):
    from urllib.parse import urlsplit
    try:
        target = json.loads(raw)
        for key in ["denWeb", "denApi", "workbot"]:
            url = urlsplit(target[key])
            local = url.hostname in ["localhost", "127.0.0.1", "::1"]
            if (url.scheme != "https" and not (url.scheme == "http" and local)) or not url.hostname:
                raise ValueError()
            if url.username or url.password or url.query or url.fragment or url.path not in ["", "/"]:
                raise ValueError()
        if not re.fullmatch(r"org_[a-z0-9]+", target["organizationId"]):
            raise ValueError()
        return target
    except (ValueError, TypeError, KeyError):
        raise SetupError("VOE_TARGET_JSON must contain canonical denWeb/denApi/workbot origins and an organizationId.") from None


def inventory(values):
    result = {
        "configuration": {},
        "connections": {"google": "not_tested", "slack": "not_tested"},
        "readyToRecord": False,
    }
    for module, keys in MODULES.items():
        result["configuration"][module] = {"VOE_" + key: "present" if "VOE_" + key in values else "missing" for key in keys}
    if "VOE_TARGET_JSON" in values:
        validate_target(values["VOE_TARGET_JSON"])
    return result


def save(key, value, replace=False):
    if key not in KEYS:
        raise SetupError("Unknown key; use one of the documented VOE_ keys.")
    if not value or "\x00" in value:
        raise SetupError("A nonempty value is required.")
    if key == "VOE_TARGET_JSON":
        validate_target(value)
    if key in load() and not replace:
        raise SetupError("Key already exists. Inspect its owner before using --replace.")
    # YAML accepts JSON strings exactly. The .yaml symlink selects that parser;
    # bytes travel over stdin, never through a regular file or process argv.
    import tempfile
    with tempfile.TemporaryDirectory(prefix="voe-") as directory:
        pipe_path = os.path.join(directory, "stdin.yaml")
        os.symlink("/dev/stdin", pipe_path)
        cli(["secrets", "set", "--file", pipe_path, "--output", "json"], json.dumps({key: value}))
    if load().get(key) != value:
        raise SetupError("Read-back did not match. Inspect Infisical; do not blindly repeat the write.")


def run(module, command, values):
    keys = ["VOE_" + key for key in MODULES[module]]
    missing = [key for key in keys if key not in values]
    if missing:
        raise SetupError("Missing required keys: " + ", ".join(missing))
    if not command:
        raise SetupError("Supply a trusted command after --.")
    # Do not give the child other modules or ambient API credentials.
    env = {key: os.environ[key] for key in ["PATH", "HOME", "USER", "LANG", "TMPDIR", "SYSTEMROOT"] if key in os.environ}
    env.update({key: values[key] for key in keys})
    result = subprocess.run(command, env=env, text=True, capture_output=True)
    def redact(text):
        for value in sorted((values[key] for key in keys), key=len, reverse=True):
            text = text.replace(value, "[REDACTED]")
        return text
    print(redact(result.stdout), end="")
    print(redact(result.stderr), end="", file=sys.stderr)
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    commands.add_parser("inventory")
    store = commands.add_parser("save", help="Read a value from stdin; never pass a secret as an argument.")
    store.add_argument("key", choices=sorted(KEYS))
    store.add_argument("--replace", action="store_true")
    child = commands.add_parser("run")
    child.add_argument("module", choices=sorted(MODULES))
    child.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    try:
        if args.action == "save":
            save(args.key, sys.stdin.read().removesuffix("\n"), args.replace)
            print(json.dumps({"saved": args.key, "verified": True}))
            return 0
        values = load()
        if args.action == "run":
            command = args.command[1:] if args.command[:1] == ["--"] else args.command
            return run(args.module, command, values)
        report = inventory(values)
        print(json.dumps(report, indent=2))
        return 0 if all(status == "present" for group in report["configuration"].values() for status in group.values()) else 2
    except (SetupError, OSError) as error:
        print(str(error) if isinstance(error, SetupError) else "Child command could not start.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
