import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Closes the CLASS of bug behind Vuln 1: a page or route handler reaching for the
// global (unscoped) Prisma client with an id taken from the request. Everything under
// src/app must go through tenantPrisma / withTenantTransaction or a service that takes
// the caller's organizationId explicitly.

const ROOT = join(import.meta.dirname, "..");
const APP_DIR = join(ROOT, "src", "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("structural guards", () => {
  const files = walk(APP_DIR);

  it("no file under src/app imports the global Prisma client", () => {
    const offenders = files
      .filter((f) => /from\s+["']@\/infrastructure\/database\/client["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders, "use tenantPrisma(ctx.organizationId) or an org-scoped service instead").toEqual([]);
  });

  it("no page/route under src/app calls `prisma.` directly", () => {
    const offenders = files
      .filter((f) => /(^|[^A-Za-z_])prisma\.[a-zA-Z$]/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("every /api/admin route enforces an admin role server-side", () => {
    const adminRoutes = files.filter((f) => f.includes(`${join("api", "admin")}`) && f.endsWith("route.ts"));
    expect(adminRoutes.length).toBeGreaterThan(0);
    const lax = adminRoutes
      .filter((f) => !/requireHR\(\s*\{\s*roles:/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(lax).toEqual([]);
  });

  it("the audit API exports only GET", () => {
    const src = readFileSync(join(APP_DIR, "api", "admin", "audit", "route.ts"), "utf8");
    const exported = [...src.matchAll(/export\s+async\s+function\s+([A-Z]+)/g)].map((m) => m[1]);
    expect(exported).toEqual(["GET"]);
  });

  it("every dangerouslySetInnerHTML in a server page is fed through the sanitizer", () => {
    const pages = files.filter((f) => f.endsWith("page.tsx") && readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"));
    const unsanitized = pages
      .filter((f) => !readFileSync(f, "utf8").includes("sanitizeContractHtml("))
      .map((f) => relative(ROOT, f));
    expect(unsanitized).toEqual([]);
  });

  // A tenant model missing from tenantPrisma runs without app.current_org: its strict
  // RLS policy then hides every row (this is how candidate alerts silently broke).
  it("every model with an organizationId is scoped in tenantPrisma", () => {
    const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
    const scoped = readFileSync(join(ROOT, "src", "infrastructure", "tenant", "scoped-prisma.ts"), "utf8");
    const tenantModels = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , body]) => /^\s+organizationId\s+String\b/m.test(body))
      .map(([, name]) => name[0].toLowerCase() + name.slice(1));
    expect(tenantModels.length).toBeGreaterThan(5);
    const missing = tenantModels.filter((m) => !new RegExp(`^\\s+${m}:`, "m").test(scoped));
    expect(missing).toEqual([]);
  });

  it("every /api/hr route requires an HR session", () => {
    const hrRoutes = files.filter((f) => f.includes(join("api", "hr")) && f.endsWith("route.ts"));
    const open = hrRoutes.filter((f) => !/requireHR\(/.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
    expect(open).toEqual([]);
  });
});
