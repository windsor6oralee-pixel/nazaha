// Enforces dependency-policy.json: every runtime dependency must be justified there,
// nothing forbidden may appear anywhere (runtime or dev), and the policy must not
// list packages that no longer exist. Exit 1 on any violation.
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const policy = JSON.parse(readFileSync("dependency-policy.json", "utf8"));

const runtime = Object.keys(pkg.dependencies ?? {});
const dev = Object.keys(pkg.devDependencies ?? {});
const justified = Object.keys(policy.runtime);
const problems = [];

for (const name of runtime) {
  if (!justified.includes(name)) problems.push(`runtime dependency "${name}" is not justified in dependency-policy.json`);
}
for (const name of justified) {
  if (!runtime.includes(name)) problems.push(`policy lists "${name}" but it is not a runtime dependency (remove it from the policy or add it back)`);
}
for (const name of [...runtime, ...dev]) {
  const hit = policy.forbiddenPatterns.find((p) => (p.endsWith("/") ? name.startsWith(p) : name === p || name.startsWith(`${p}@`)));
  if (hit) problems.push(`"${name}" matches forbidden pattern "${hit}"`);
}

if (problems.length) {
  console.error("✖ dependency policy violations:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log(`✔ dependency policy: ${runtime.length} runtime dependencies, all justified; nothing forbidden.`);
