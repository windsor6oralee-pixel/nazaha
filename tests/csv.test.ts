import { describe, expect, it } from "vitest";
import { parseCsvRecords } from "@/lib/csv";

describe("parseCsvRecords", () => {
  it("keeps a comma inside a quoted password in that column", () => {
    const text = 'name,email,password\n"علي، محمد",ali@example.com,"Ab,cd1234!"\n';
    const [row] = parseCsvRecords(text);
    expect(row.name).toBe("علي، محمد");
    expect(row.email).toBe("ali@example.com");
    expect(row.password).toBe("Ab,cd1234!");
  });

  it("unescapes a doubled quote and ignores a trailing blank line", () => {
    const text = 'name,email,password\n"قال ""مرحبا""",a@b.co,Secret1234\n\n';
    const rows = parseCsvRecords(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('قال "مرحبا"');
    expect(rows[0].password).toBe("Secret1234");
  });
});
