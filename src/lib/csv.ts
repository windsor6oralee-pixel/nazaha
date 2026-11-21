/**
 * RFC-style CSV reader for accepted-candidate sheets.
 *
 * The previous split-on-comma reader moved a password into the next column
 * whenever a name or password contained a comma. That would activate the
 * wrong account. Quoted fields and doubled quotes are preserved exactly,
 * except for a trim of surrounding whitespace.
 */
export function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cur.trim());
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cur.trim());
      cur = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

/** First row is the header. Header keys are trimmed and lowercased. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const table = parseCsvTable(text);
  if (table.length < 2) return [];
  const headers = table[0].map((h) => h.trim().toLowerCase());
  return table.slice(1).map((vals) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      if (!h) return;
      obj[h] = vals[j] ?? "";
    });
    return obj;
  });
}
