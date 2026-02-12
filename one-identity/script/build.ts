import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin";

const bunRuntime = (globalThis as typeof globalThis & {
  Bun?: {
    build?: (...args: any[]) => Promise<any>;
  };
}).Bun;

if (!bunRuntime?.build) {
  console.error("agentmint build step requires Bun runtime for OpenTUI TSX transform.");
  process.exit(1);
}

mkdirSync(resolve("dist", "tui"), { recursive: true });

const result = await bunRuntime.build({
  tsconfig: "./tsconfig.json",
  plugins: [solidPlugin],
  entrypoints: [resolve("src", "tui", "bootstrap.tsx")],
  outdir: resolve("dist", "tui"),
  format: "esm",
  target: "bun",
  sourcemap: "external",
});

if (!result.success) {
  for (const log of result.logs || []) {
    console.error(log);
  }
  process.exit(1);
}
