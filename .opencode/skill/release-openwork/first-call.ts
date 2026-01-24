import { config } from "./load-env";

async function main() {
  void config;
  console.log("release-openwork: no credentials required.");
}

main().catch((error) => {
  console.error(error);
});
