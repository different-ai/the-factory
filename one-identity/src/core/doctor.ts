import fs from "node:fs";
import { spawnSync } from "node:child_process";

import { getPaths } from "./paths.js";

export type DoctorCheck = {
  name: string;
  status: "ok" | "warn";
  detail: string;
};

function commandExists(command: string): boolean {
  const out = spawnSync("sh", ["-c", `command -v ${command}`], { encoding: "utf8" });
  return out.status === 0;
}

export function runDoctor(): DoctorCheck[] {
  const paths = getPaths();
  fs.mkdirSync(paths.baseDir, { recursive: true });
  fs.mkdirSync(paths.packsDir, { recursive: true });
  fs.mkdirSync(paths.secretsDir, { recursive: true });

  const checks: DoctorCheck[] = [];
  checks.push({
    name: "storage",
    status: "ok",
    detail: `Using ${paths.baseDir}`,
  });

  checks.push({
    name: "node",
    status: commandExists("node") ? "ok" : "warn",
    detail: commandExists("node") ? "node is available" : "node is missing",
  });

  checks.push({
    name: "bitwarden-cli",
    status: commandExists("bw") ? "ok" : "warn",
    detail: commandExists("bw") ? "bw is available" : "bw not found (install for live vault operations)",
  });

  checks.push({
    name: "agentmail-api-key",
    status: process.env.AGENTMAIL_API_KEY ? "ok" : "warn",
    detail: process.env.AGENTMAIL_API_KEY ? "AGENTMAIL_API_KEY present" : "AGENTMAIL_API_KEY missing",
  });

  checks.push({
    name: "oneclaw-profile",
    status: "ok",
    detail: `Default profile path ${paths.configDir}`,
  });

  checks.push({
    name: "git",
    status: commandExists("git") ? "ok" : "warn",
    detail: commandExists("git") ? "git is available" : "git is missing",
  });

  return checks;
}
