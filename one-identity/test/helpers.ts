import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function setupTempHome(): { dir: string; cleanup: () => void; restore: () => void } {
  const prev = process.env.ONECLAW_HOME;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oneclaw-test-"));
  process.env.ONECLAW_HOME = dir;
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
    restore: () => {
      if (prev === undefined) {
        delete process.env.ONECLAW_HOME;
        return;
      }
      process.env.ONECLAW_HOME = prev;
    },
  };
}
