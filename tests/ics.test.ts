import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine } from "../lib/ics";
import { parsePlanParams } from "../lib/plan";

function plan(crops: string, ff = "2026-10-05") {
  const r = parsePlanParams({ lf: "2026-05-15", ff, crops });
  if (!r.ok) throw new Error(r.error);
  return r.plan;
}

describe("buildIcs", () => {
  const body = buildIcs(plan("lettuce:14:2:-28:14:55"));

  it("wraps in VCALENDAR with CRLF line endings only", () => {
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body.replace(/\r\n/g, "")).not.toContain("\n"); // no bare LF
    expect(body.replace(/\r\n/g, "")).not.toContain("\r"); // no bare CR
  });

  it("emits exactly 6 all-day VEVENTs with the spec's dates (check 1)", () => {
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(6);
    expect(body.match(/END:VEVENT/g)).toHaveLength(6);
    for (const d of ["20260417", "20260501", "20260515", "20260611", "20260625"]) {
      expect(body).toContain(`DTSTART;VALUE=DATE:${d}`);
    }
    expect(body).toContain("SUMMARY:Sow Lettuce #1");
    expect(body).toContain("SUMMARY:Sow Lettuce #2");
    expect(body).toContain("SUMMARY:Transplant Lettuce #1");
    expect(body).toContain("SUMMARY:Harvest Lettuce #2");
    // No timed events at all:
    expect(body).not.toMatch(/DTSTART[:;](?!VALUE=DATE)/);
  });

  it("uses deterministic UIDs matching <type>-<crop>-<n>@sowcal (check 3)", () => {
    const uids = [...body.matchAll(/UID:(\S+)/g)].map((m) => m[1]);
    expect(uids).toHaveLength(6);
    for (const uid of uids) {
      expect(uid).toMatch(/^(sow|transplant|harvest)-[a-z0-9-]+-\d+@sowcal$/);
    }
    expect(new Set(uids).size).toBe(6);
    expect(uids).toContain("sow-lettuce-1@sowcal");
    expect(uids).toContain("harvest-lettuce-2@sowcal");
  });

  it("is byte-identical across calls — no now()-derived content (check 3)", () => {
    const again = buildIcs(plan("lettuce:14:2:-28:14:55"));
    expect(again).toBe(body);
    // DTSTAMP derives from lf, not from the wall clock:
    expect(body.match(/DTSTAMP:20260515T000000Z/g)).toHaveLength(6);
  });

  it("emits no transplant events for direct-sow crops (check 2)", () => {
    const carrot = buildIcs(plan("carrot:21:3:0:-:70"));
    expect(carrot.match(/BEGIN:VEVENT/g)).toHaveLength(6);
    expect(carrot).not.toContain("Transplant");
    expect(carrot).toContain("DTSTART;VALUE=DATE:20260515");
    expect(carrot).toContain("DTSTART;VALUE=DATE:20260626");
  });

  it("appends the frost-risk suffix only past ff (check 5)", () => {
    const risky = buildIcs(plan("lettuce:14:2:-28:14:55", "2026-06-20"));
    expect(risky).toContain("SUMMARY:Harvest Lettuce #1\r\n");
    expect(risky).toContain("SUMMARY:Harvest Lettuce #2 (frost risk)");
  });

  it("folds long lines at 75 octets with space continuations", () => {
    const long = buildIcs(
      plan("super-extra-long-custom-crop-name-for-folding-test-purposes:14:1:0:-:60")
    );
    for (const line of long.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    // Unfolding restores the original content line:
    const unfolded = long.replace(/\r\n[ \t]/g, "");
    expect(unfolded).toContain(
      "SUMMARY:Sow Super Extra Long Custom Crop Name For Folding Test Purposes #1"
    );
  });

  it("foldIcsLine keeps short lines untouched and folds multibyte safely", () => {
    expect(foldIcsLine("SUMMARY:Sow Lettuce #1")).toBe("SUMMARY:Sow Lettuce #1");
    const folded = foldIcsLine("SUMMARY:" + "ü".repeat(100));
    for (const line of folded.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "ü".repeat(100));
  });

  it("escapes ICS TEXT special characters", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});
