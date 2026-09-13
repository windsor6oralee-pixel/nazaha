// Allow-list HTML sanitizer for contract templates. No dependencies by design.
//
// Contract bodies are authored by tenant admins but rendered inside OTHER people's
// sessions (candidates signing, HR viewing), so admin-authored markup is untrusted.
// The model is simple: only structural tags survive, only `class` survives as an
// attribute and only with known values, everything else (including every URL-bearing
// attribute and every inline handler) is dropped. Content of script-like elements is
// removed entirely, not just their tags.

const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s",
  "ol", "ul", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "div", "span", "blockquote", "small", "sup", "sub",
]);
const VOID_TAGS = new Set(["br", "hr"]);
const ALLOWED_CLASSES = new Set(["meta", "parties", "signatures", "sig-line", "missing", "text-center", "muted"]);

// Elements whose entire content must go, not only their tags.
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript", "textarea", "title", "xmp", "plaintext"];

const CONTENT_RE = new RegExp(
  `<(${DROP_WITH_CONTENT.join("|")})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>|<(${DROP_WITH_CONTENT.join("|")})\\b[^>]*\\/?>`,
  "gi"
);
const COMMENT_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[\s\S]*?\?>/g;
const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const CLASS_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

function sanitizeClass(attrs: string): string {
  const m = CLASS_RE.exec(attrs);
  if (!m) return "";
  const value = (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c));
  return value.length ? ` class="${value.join(" ")}"` : "";
}

export function sanitizeContractHtml(input: string): string {
  if (!input) return "";
  let html = input.replace(COMMENT_RE, "");
  // Run until stable: removing one element can expose another nested inside its attributes.
  let prev: string;
  do {
    prev = html;
    html = html.replace(CONTENT_RE, "");
  } while (html !== prev);

  return html.replace(TAG_RE, (_m, slash: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (slash) return VOID_TAGS.has(name) ? "" : `</${name}>`;
    if (VOID_TAGS.has(name)) return `<${name}/>`;
    return `<${name}${sanitizeClass(attrs)}>`;
  });
}

// True when sanitizing would change the input — used to reject templates at save time
// with a clear message instead of silently altering what the admin wrote.
export function containsDisallowedHtml(input: string): boolean {
  return sanitizeContractHtml(input) !== input.replace(COMMENT_RE, "");
}
