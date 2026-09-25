import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const helper = fileURLToPath(new URL("./applescript_eval.sh", import.meta.url));
const denied = spawnSync("bash", [helper, "--activate"], { encoding: "utf8" });
assert.equal(denied.status, 2);
assert.match(denied.stderr, /FOREGROUND_OPT_IN_REQUIRED/);
// Missing target must still fail before browser access after explicit opt-in.
const incomplete = spawnSync("bash", [helper, "--activate", "--allow-foreground"], { encoding: "utf8" });
assert.notEqual(incomplete.status, 0);
assert.doesNotMatch(incomplete.stderr, /FOREGROUND_OPT_IN_REQUIRED/);
console.log("foreground gate tests passed");
