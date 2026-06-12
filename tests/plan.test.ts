import { describe, expect, it } from "vitest";
import {
  addDays,
  groupByWeek,
  mondayOf,
  parsePlanParams,
  planEvents,
  planToQuery,
  formatLong,
} from "../lib/plan";

const OK = { lf: "2026-05-15", ff: "2026-10-05" };

function mustParse(params: { lf?: string; ff?: string; crops?: string }) {
  const r = parsePlanParams(params);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.plan;
}

describe("date math", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-04-17", 55)).toBe("2026-06-11");
    expect(addDays("2026-05-15", -28)).toBe("2026-04-17");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("computes spec check 1 (transplanted lettuce, override trio)", () => {
    const plan = mustParse({ ...OK, crops: "lettuce:14:2:-28:14:55" });
    const events = planEvents(plan);
    expect(events).toHaveLength(6);
    const by = (type: string) => events.filter((e) => e.type === type).map((e) => e.date);
    expect(by("sow")).toEqual(["2026-04-17", "2026-05-01"]);
    expect(by("transplant")).toEqual(["2026-05-01", "2026-05-15"]);
    expect(by("harvest")).toEqual(["2026-06-11", "2026-06-25"]);
    expect(events.map((e) => e.summary).sort()).toEqual([
      "Harvest Lettuce #1",
      "Harvest Lettuce #2",
      "Sow Lettuce #1",
      "Sow Lettuce #2",
      "Transplant Lettuce #1",
      "Transplant Lettuce #2",
    ]);
  });

  it("computes spec check 2 (direct-sow carrot, no transplant events)", () => {
    const plan = mustParse({ ...OK, crops: "carrot:21:3:0:-:70" });
    const events = planEvents(plan);
    expect(events).toHaveLength(6);
    expect(events.some((e) => e.type === "transplant")).toBe(false);
    expect(events.some((e) => e.summary.includes("Transplant"))).toBe(false);
    const sows = events.filter((e) => e.type === "sow").map((e) => e.date);
    expect(sows).toEqual(["2026-05-15", "2026-06-05", "2026-06-26"]);
  });

  it("marks frost risk only on harvests after ff (spec check 5)", () => {
    const plan = mustParse({ lf: "2026-05-15", ff: "2026-06-20", crops: "lettuce:14:2:-28:14:55" });
    const harvests = planEvents(plan).filter((e) => e.type === "harvest");
    expect(harvests[0].summary).toBe("Harvest Lettuce #1");
    expect(harvests[1].summary).toBe("Harvest Lettuce #2 (frost risk)");
  });

  it("harvest exactly on ff is not frost risk", () => {
    const plan = mustParse({ lf: "2026-05-15", ff: "2026-06-11", crops: "lettuce:14:1:-28:14:55" });
    const harvests = planEvents(plan).filter((e) => e.type === "harvest");
    expect(harvests[0].summary).toBe("Harvest Lettuce #1");
  });

  it("uses built-in defaults when the trio is omitted", () => {
    const plan = mustParse({ ...OK, crops: "lettuce:14:2" });
    const crop = plan.crops[0];
    expect(crop.sowOffset).toBe(-28);
    expect(crop.transplantAfter).toBe(21);
    expect(crop.daysToHarvest).toBe(55);
  });

  it("override trio wins over built-in defaults", () => {
    const plan = mustParse({ ...OK, crops: "lettuce:14:2:-10:5:40" });
    const crop = plan.crops[0];
    expect(crop.sowOffset).toBe(-10);
    expect(crop.transplantAfter).toBe(5);
    expect(crop.daysToHarvest).toBe(40);
  });
});

describe("parsePlanParams validation", () => {
  it("rejects a malformed lf, naming the field (spec check 8)", () => {
    const r = parsePlanParams({ lf: "notadate", crops: "lettuce:14:2" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("lf");
  });

  it("rejects an unknown crop id without a full trio, naming the id (spec check 8)", () => {
    const r = parsePlanParams({ ...OK, crops: "quinoa:14:2" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("quinoa");
  });

  it("accepts an unknown crop id WITH a full override trio", () => {
    const plan = mustParse({ ...OK, crops: "quinoa:14:2:0:-:90" });
    expect(plan.crops[0].name).toBe("Quinoa");
    expect(planEvents(plan)).toHaveLength(4);
  });

  it("rejects malformed crop specs and impossible dates", () => {
    expect(parsePlanParams({ ...OK, crops: "lettuce:14" }).ok).toBe(false);
    expect(parsePlanParams({ ...OK, crops: "lettuce:abc:2" }).ok).toBe(false);
    expect(parsePlanParams({ ...OK, crops: "lettuce:14:2:1:2" }).ok).toBe(false);
    expect(parsePlanParams({ lf: "2026-02-30", ff: OK.ff, crops: "lettuce:14:2" }).ok).toBe(false);
    expect(parsePlanParams({ ...OK }).ok).toBe(false);
    expect(parsePlanParams({ lf: OK.lf, crops: "lettuce:14:2" }).ok).toBe(false);
  });
});

describe("week grouping and links", () => {
  it("groups under Monday-start weeks (spec check 6: 2026-04-17 is in week of 2026-04-13)", () => {
    expect(mondayOf("2026-04-17")).toBe("2026-04-13");
    expect(mondayOf("2026-04-13")).toBe("2026-04-13");
    expect(mondayOf("2026-04-19")).toBe("2026-04-13"); // Sunday belongs to preceding Monday
    const plan = mustParse({ ...OK, crops: "lettuce:14:2:-28:14:55" });
    const weeks = groupByWeek(planEvents(plan));
    const w1 = weeks.find((w) => w.monday === "2026-04-13");
    expect(w1).toBeDefined();
    expect(w1!.events.map((e) => e.summary)).toContain("Sow Lettuce #1");
    expect(formatLong("2026-04-13")).toBe("April 13, 2026");
  });

  it("round-trips the canonical query string with overrides intact (spec check 7)", () => {
    const plan = mustParse({ ...OK, crops: "lettuce:14:2:-28:14:55" });
    expect(planToQuery(plan)).toBe(
      "lf=2026-05-15&ff=2026-10-05&crops=lettuce:14:2:-28:14:55"
    );
  });
});
