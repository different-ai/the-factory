import fs from "node:fs";
import path from "node:path";

import { resolveSecret } from "../core/secrets.js";
import type { IdentityPack, TargetId } from "../core/types.js";

import { buildOpenClawFragment, applyOpenClawConfig } from "./openclaw.js";
import { buildOwpenbotFragment, applyOwpenbotConfig } from "./owpenbot.js";
import { exportNanoClawEnv, applyNanoClawEnv } from "./nanoclaw.js";

const ctx = {
  resolveSecret,
};

export function exportPackToTarget(pack: IdentityPack, target: TargetId): string {
  if (target === "owpenbot") {
    return `${JSON.stringify(buildOwpenbotFragment(pack, ctx), null, 2)}\n`;
  }
  if (target === "openclaw") {
    return `${JSON.stringify(buildOpenClawFragment(pack, ctx), null, 2)}\n`;
  }
  return exportNanoClawEnv(pack, ctx);
}

export function writeExport(pack: IdentityPack, target: TargetId, outPath: string, dryRun: boolean): string {
  const rendered = exportPackToTarget(pack, target);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, rendered, "utf8");
  }
  return rendered;
}

export function applyPack(pack: IdentityPack, target: TargetId, targetPath: string, dryRun: boolean): unknown {
  if (target === "owpenbot") {
    return applyOwpenbotConfig(pack, ctx, targetPath, dryRun);
  }
  if (target === "openclaw") {
    return applyOpenClawConfig(pack, ctx, targetPath, dryRun);
  }
  return applyNanoClawEnv(pack, ctx, targetPath, dryRun);
}
