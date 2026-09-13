import { describe, it, expect } from "vitest";
import { sanitizeContractHtml, containsDisallowedHtml } from "@/infrastructure/contracts/html-sanitizer";
import { renderTemplate } from "@/infrastructure/contracts/template-renderer";

// Closes Vuln 2 (stored XSS via admin-authored contract templates).
// Every payload here bypassed the previous regex check.

const PAYLOADS: [string, string][] = [
  ["javascript: href",         `<a href="javascript:alert(1)">x</a>`],
  ["iframe srcdoc (entities)",  `<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>`],
  ["object data",               `<object data="javascript:alert(1)"></object>`],
  ["embed",                     `<embed src="data:text/html,<script>alert(1)</script>">`],
  ["svg animate href",          `<svg><animate attributeName="href" values="javascript:alert(1)"/><a><text>x</text></a></svg>`],
  ["form action",               `<form action="javascript:alert(1)"><button>go</button></form>`],
  ["img onerror (newline)",     `<img src=x\nonerror=alert(1)>`],
  ["img onerror (tab)",         `<img src=x\tonerror=alert(1)>`],
  ["script mixed case",         `<ScRiPt>alert(1)</sCrIpT>`],
  ["script in comment split",   `<!-- --><scr<!-- -->ipt>alert(1)</script>`],
  ["style expression",          `<style>body{background:url(javascript:alert(1))}</style>`],
  ["meta refresh",              `<meta http-equiv="refresh" content="0;url=javascript:alert(1)">`],
  ["math",                      `<math><maction actiontype="statusline#javascript:alert(1)">x</maction></math>`],
  ["nested in allowed tag",     `<p><span onmouseover="alert(1)">x</span></p>`],
  ["style attribute",           `<p style="background:url(javascript:alert(1))">x</p>`],
  ["id/data attributes",        `<div id="x" data-a="b" tabindex="0">x</div>`],
];

describe("sanitizeContractHtml", () => {
  it.each(PAYLOADS)("neutralises %s", (_name, payload) => {
    const out = sanitizeContractHtml(payload);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/\son[a-z]+\s*=/i);
    expect(out).not.toMatch(/<(iframe|object|embed|svg|math|form|meta|style|img|a)\b/i);
    expect(out).not.toMatch(/\s(href|src|srcdoc|style|data-[a-z]+|id|tabindex)\s*=/i);
  });

  it("keeps the structural markup the default templates use", () => {
    const input = `<h1>عقد</h1><p class="meta">x</p><table class="parties"><tr><th>a</th><td><strong>b</strong><br/>c</td></tr></table><ol><li>1</li></ol><span class="sig-line">s</span>`;
    const out = sanitizeContractHtml(input);
    expect(out).toContain("<h1>");
    expect(out).toContain(`<p class="meta">`);
    expect(out).toContain(`<table class="parties">`);
    expect(out).toContain("<strong>b</strong>");
    expect(out).toContain("<br/>");
    expect(out).toContain(`<span class="sig-line">`);
  });

  it("drops unknown class names but keeps known ones", () => {
    expect(sanitizeContractHtml(`<p class="meta evil">x</p>`)).toBe(`<p class="meta">x</p>`);
    expect(sanitizeContractHtml(`<p class="evil">x</p>`)).toBe(`<p>x</p>`);
  });

  it("is idempotent (safe to apply at save, render, and display)", () => {
    for (const [, p] of PAYLOADS) {
      const once = sanitizeContractHtml(p);
      expect(sanitizeContractHtml(once)).toBe(once);
    }
  });

  it("containsDisallowedHtml flags every payload and passes clean markup", () => {
    for (const [, p] of PAYLOADS) expect(containsDisallowedHtml(p)).toBe(true);
    expect(containsDisallowedHtml(`<h2>x</h2><p class="meta">y</p>`)).toBe(false);
  });

  it("renderTemplate output is sanitized even when the stored template is hostile", () => {
    const out = renderTemplate(`<p>{{candidate.nameAr}}</p><img src=x onerror=alert(1)>`, { "candidate.nameAr": "<b>x</b>" } as never);
    expect(out).toBe(`<p>&lt;b&gt;x&lt;/b&gt;</p>`);
  });
});
