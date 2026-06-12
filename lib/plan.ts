// Pure plan logic: parameter parsing/validation and date math.
// No Date.now() / new Date() anywhere — everything derives from the parameters,
// so feed output is deterministic (byte-identical across requests).

import { CROPS_BY_ID, titleizeId } from "./crops";

export interface PlanCrop {
  id: string;
  name: string;
  intervalDays: number;
  count: number;
  sowOffset: number;
  transplantAfter: number | null; // null = direct-sow
  daysToHarvest: number;
}

export interface Plan {
  lf: string; // last spring frost, YYYY-MM-DD
  ff: string; // first fall frost, YYYY-MM-DD
  crops: PlanCrop[];
}

export type EventType = "sow" | "transplant" | "harvest";

export interface PlanEvent {
  type: EventType;
  cropId: string;
  cropName: string;
  n: number; // succession number, 1-based
  date: string; // YYYY-MM-DD
  summary: string; // e.g. "Sow Lettuce #1", "Harvest Lettuce #2 (frost risk)"
  uid: string; // e.g. "sow-lettuce-1@sowcal"
}

export type ParseResult =
  | { ok: true; plan: Plan }
  | { ok: false; error: string };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const DAY_MS = 86400000;

/** Parse YYYY-MM-DD into a UTC epoch-ms timestamp, or null if invalid. */
export function parseIsoDate(s: string): number | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const dt = new Date(t);
  if (
    dt.getUTCFullYear() !== Number(y) ||
    dt.getUTCMonth() !== Number(mo) - 1 ||
    dt.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return t;
}

export function toIsoDate(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: string, days: number): string {
  const t = parseIsoDate(iso);
  if (t === null) throw new Error(`addDays: invalid date ${iso}`);
  return toIsoDate(t + days * DAY_MS);
}

function intInRange(
  raw: string,
  field: string,
  min: number,
  max: number
): { ok: true; value: number } | { ok: false; error: string } {
  if (!/^-?\d+$/.test(raw)) {
    return { ok: false, error: `Invalid ${field}: "${raw}" is not an integer.` };
  }
  const v = Number(raw);
  if (v < min || v > max) {
    return {
      ok: false,
      error: `Invalid ${field}: ${v} is out of range (${min} to ${max}).`,
    };
  }
  return { ok: true, value: v };
}

function parseCropSpec(spec: string): { ok: true; crop: PlanCrop } | { ok: false; error: string } {
  const parts = spec.split(":");
  if (parts.length !== 3 && parts.length !== 6) {
    return {
      ok: false,
      error: `Malformed crop spec "${spec}": expected id:intervalDays:count or id:intervalDays:count:sowOffset:transplantAfter:daysToHarvest.`,
    };
  }
  const id = parts[0].toLowerCase();
  if (!ID_RE.test(id)) {
    return { ok: false, error: `Malformed crop spec "${spec}": invalid crop id "${parts[0]}".` };
  }
  const defaults = CROPS_BY_ID.get(id);
  if (!defaults && parts.length === 3) {
    return {
      ok: false,
      error: `Unknown crop id "${id}": not in the built-in crop table. Provide the full override trio (id:intervalDays:count:sowOffset:transplantAfter:daysToHarvest) to use a custom crop.`,
    };
  }

  const interval = intInRange(parts[1], `intervalDays for "${id}"`, 1, 365);
  if (!interval.ok) return interval;
  const count = intInRange(parts[2], `count for "${id}"`, 1, 100);
  if (!count.ok) return count;

  let sowOffset: number;
  let transplantAfter: number | null;
  let daysToHarvest: number;

  if (parts.length === 6) {
    const so = intInRange(parts[3], `sowOffset for "${id}"`, -365, 365);
    if (!so.ok) return so;
    sowOffset = so.value;
    if (parts[4] === "-") {
      transplantAfter = null;
    } else {
      const ta = intInRange(parts[4], `transplantAfter for "${id}"`, 0, 365);
      if (!ta.ok) return ta;
      transplantAfter = ta.value;
    }
    const dth = intInRange(parts[5], `daysToHarvest for "${id}"`, 1, 365);
    if (!dth.ok) return dth;
    daysToHarvest = dth.value;
  } else {
    sowOffset = defaults!.sowOffset;
    transplantAfter = defaults!.transplantAfter;
    daysToHarvest = defaults!.daysToHarvest;
  }

  return {
    ok: true,
    crop: {
      id,
      name: defaults ? defaults.name : titleizeId(id),
      intervalDays: interval.value,
      count: count.value,
      sowOffset,
      transplantAfter,
      daysToHarvest,
    },
  };
}

export function parsePlanParams(params: {
  lf?: string | null;
  ff?: string | null;
  crops?: string | null;
}): ParseResult {
  const { lf, ff, crops } = params;

  if (!lf) return { ok: false, error: "Missing lf: last spring frost date (YYYY-MM-DD) is required." };
  if (parseIsoDate(lf) === null) {
    return { ok: false, error: `Invalid lf: "${lf}" is not a valid date (expected YYYY-MM-DD).` };
  }
  if (!ff) return { ok: false, error: "Missing ff: first fall frost date (YYYY-MM-DD) is required." };
  if (parseIsoDate(ff) === null) {
    return { ok: false, error: `Invalid ff: "${ff}" is not a valid date (expected YYYY-MM-DD).` };
  }
  if (!crops) return { ok: false, error: "Missing crops: at least one crop spec is required." };

  const specs = crops.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (specs.length === 0) {
    return { ok: false, error: "Missing crops: at least one crop spec is required." };
  }
  if (specs.length > 60) {
    return { ok: false, error: `Invalid crops: too many crop specs (${specs.length}, max 60).` };
  }

  const parsed: PlanCrop[] = [];
  for (const spec of specs) {
    const r = parseCropSpec(spec);
    if (!r.ok) return r;
    parsed.push(r.crop);
  }

  return { ok: true, plan: { lf, ff, crops: parsed } };
}

const TYPE_ORDER: Record<EventType, number> = { sow: 0, transplant: 1, harvest: 2 };
const TYPE_VERB: Record<EventType, string> = {
  sow: "Sow",
  transplant: "Transplant",
  harvest: "Harvest",
};

/** Compute every sow/transplant/harvest event for the plan, in season order. */
export function planEvents(plan: Plan): PlanEvent[] {
  const events: PlanEvent[] = [];
  for (const crop of plan.crops) {
    for (let n = 1; n <= crop.count; n++) {
      const sowDate = addDays(plan.lf, crop.sowOffset + (n - 1) * crop.intervalDays);
      const push = (type: EventType, date: string, frostRisk: boolean) => {
        const suffix = frostRisk ? " (frost risk)" : "";
        events.push({
          type,
          cropId: crop.id,
          cropName: crop.name,
          n,
          date,
          summary: `${TYPE_VERB[type]} ${crop.name} #${n}${suffix}`,
          uid: `${type}-${crop.id}-${n}@sowcal`,
        });
      };
      push("sow", sowDate, false);
      if (crop.transplantAfter !== null) {
        push("transplant", addDays(sowDate, crop.transplantAfter), false);
      }
      const harvestDate = addDays(sowDate, crop.daysToHarvest);
      const frostRisk = parseIsoDate(harvestDate)! > parseIsoDate(plan.ff)!;
      push("harvest", harvestDate, frostRisk);
    }
  }
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.cropId.localeCompare(b.cropId) ||
      a.n - b.n
  );
  return events;
}

/** Canonical crop spec string (always the full 6-field form, so overrides survive round-trips). */
export function cropToSpec(c: PlanCrop): string {
  const ta = c.transplantAfter === null ? "-" : String(c.transplantAfter);
  return `${c.id}:${c.intervalDays}:${c.count}:${c.sowOffset}:${ta}:${c.daysToHarvest}`;
}

/** Canonical query string for a plan. Colons/commas/hyphens are legal in query values
 *  and are deliberately NOT percent-encoded, so links stay human-readable. */
export function planToQuery(plan: Plan): string {
  return `lf=${plan.lf}&ff=${plan.ff}&crops=${plan.crops.map(cropToSpec).join(",")}`;
}

/** Monday (YYYY-MM-DD) of the week containing the given date. */
export function mondayOf(iso: string): string {
  const t = parseIsoDate(iso);
  if (t === null) throw new Error(`mondayOf: invalid date ${iso}`);
  const day = new Date(t).getUTCDay(); // 0 = Sunday
  const back = (day + 6) % 7;
  return toIsoDate(t - back * DAY_MS);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "April 13, 2026" — locale-independent. */
export function formatLong(iso: string): string {
  const d = new Date(parseIsoDate(iso)!);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Fri, Apr 17" — locale-independent. */
export function formatShort(iso: string): string {
  const d = new Date(parseIsoDate(iso)!);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

/** Group events into Monday-start weeks, in season order. */
export function groupByWeek(events: PlanEvent[]): { monday: string; events: PlanEvent[] }[] {
  const weeks: { monday: string; events: PlanEvent[] }[] = [];
  const byMonday = new Map<string, PlanEvent[]>();
  for (const ev of events) {
    const monday = mondayOf(ev.date);
    let bucket = byMonday.get(monday);
    if (!bucket) {
      bucket = [];
      byMonday.set(monday, bucket);
      weeks.push({ monday, events: bucket });
    }
    bucket.push(ev);
  }
  weeks.sort((a, b) => a.monday.localeCompare(b.monday));
  return weeks;
}
