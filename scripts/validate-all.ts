import "dotenv/config";
import { run } from "./validate/_validate-runner.js";

run().catch((e) => {
  console.error("Fallo validate-all:", e);
  process.exitCode = 1;
});
