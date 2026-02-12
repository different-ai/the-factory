import os from "node:os";
import path from "node:path";

export type OneClawPaths = {
  baseDir: string;
  packsDir: string;
  secretsDir: string;
  configDir: string;
  runsDir: string;
};

export function getPaths(): OneClawPaths {
  const baseDir = process.env.ONECLAW_HOME?.trim() || path.join(os.homedir(), ".oneclaw");
  return {
    baseDir,
    packsDir: path.join(baseDir, "packs"),
    secretsDir: path.join(baseDir, "secrets"),
    configDir: path.join(baseDir, "config"),
    runsDir: path.join(baseDir, "runs"),
  };
}
