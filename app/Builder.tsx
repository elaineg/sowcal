"use client";

import { useState, useSyncExternalStore } from "react";
import { CROPS, CROPS_BY_ID } from "@/lib/crops";

export interface BuilderRow {
  key: string;
  id: string;
  name: string;
  interval: string;
  count: string;
  adjust: boolean;
  sowOffset: string;
  directSow: boolean;
  transplantAfter: string;
  daysToHarvest: string;
}

export interface BuilderInitial {
  lf: string;
  ff: string;
  rows: BuilderRow[];
}

// Origin is only knowable in the browser; useSyncExternalStore avoids
// setState-in-effect (server snapshot renders relative URLs, client upgrades them).
const emptySubscribe = () => () => {};
function useOrigin(): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => ""
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPosInt(s: string): boolean {
  return /^\d+$/.test(s) && Number(s) >= 1;
}
function isInt(s: string): boolean {
  return /^-?\d+$/.test(s);
}

function rowToSpec(r: BuilderRow): string {
  const ta = r.directSow ? "-" : r.transplantAfter;
  return `${r.id}:${r.interval}:${r.count}:${r.sowOffset}:${ta}:${r.daysToHarvest}`;
}

function rowProblem(r: BuilderRow): string | null {
  if (!isPosInt(r.interval)) return `${r.name}: re-sow interval must be a positive number of days.`;
  if (!isPosInt(r.count)) return `${r.name}: successions must be a positive number.`;
  if (!isInt(r.sowOffset)) return `${r.name}: sow offset must be a whole number of days.`;
  if (!r.directSow && !isPosInt(r.transplantAfter))
    return `${r.name}: transplant-after must be a positive number of days.`;
  if (!isPosInt(r.daysToHarvest)) return `${r.name}: days to harvest must be a positive number.`;
  return null;
}

let rowCounter = 0;
function freshKey(id: string): string {
  rowCounter += 1;
  return `${id}-${rowCounter}`;
}

function CopyField({
  label,
  value,
  testId,
  hint,
}: {
  label: string;
  value: string;
  testId: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        {hint ? <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span> : null}
      </div>
      <div className="mt-1 flex gap-2">
        <input
          readOnly
          value={value}
          data-testid={testId}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
        />
        <button
          type="button"
          data-testid={`${testId}-copy`}
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 active:bg-emerald-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base dark:border-gray-600 dark:bg-gray-800";
const numCls = inputCls + " tabular-nums";

export default function Builder({ initial }: { initial: BuilderInitial }) {
  const [lf, setLf] = useState(initial.lf);
  const [ff, setFf] = useState(initial.ff);
  const [rows, setRows] = useState<BuilderRow[]>(initial.rows);
  const origin = useOrigin();

  const updateRow = (key: string, patch: Partial<BuilderRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addCrop = (id: string) => {
    const c = CROPS_BY_ID.get(id);
    if (!c) return;
    setRows((rs) => [
      ...rs,
      {
        key: freshKey(id),
        id: c.id,
        name: c.name,
        interval: String(c.intervalDays),
        count: "3",
        adjust: false,
        sowOffset: String(c.sowOffset),
        directSow: c.transplantAfter === null,
        transplantAfter: c.transplantAfter === null ? "21" : String(c.transplantAfter),
        daysToHarvest: String(c.daysToHarvest),
      },
    ]);
  };

  const problems: string[] = [];
  if (!DATE_RE.test(lf)) problems.push("Enter the last spring frost date.");
  if (!DATE_RE.test(ff)) problems.push("Enter the first fall frost date.");
  if (rows.length === 0) problems.push("Add at least one crop.");
  for (const r of rows) {
    const p = rowProblem(r);
    if (p) problems.push(p);
  }

  const query =
    problems.length === 0
      ? `lf=${lf}&ff=${ff}&crops=${rows.map(rowToSpec).join(",")}`
      : null;
  const planUrl = query ? `${origin}/plan?${query}` : "";
  const feedUrl = query ? `${origin}/api/feed.ics?${query}` : "";
  const webcalUrl =
    feedUrl && origin ? feedUrl.replace(/^https?:\/\//, "webcal://") : feedUrl;

  return (
    <main className="mx-auto max-w-2xl p-6 pb-16">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">SowCal</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Turn your frost dates and crop list into a subscribable calendar feed and a
          printable week-by-week planting plan. No account — the URL is the save file.
        </p>
      </header>

      <section className="mt-8" aria-labelledby="frost-heading">
        <h2 id="frost-heading" className="text-lg font-semibold">
          1. Frost dates
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Last spring frost</span>
            <input
              type="date"
              value={lf}
              data-testid="lf-input"
              onChange={(e) => setLf(e.target.value)}
              className={inputCls + " mt-1"}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">First fall frost</span>
            <input
              type="date"
              value={ff}
              data-testid="ff-input"
              onChange={(e) => setFf(e.target.value)}
              className={inputCls + " mt-1"}
            />
          </label>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="crops-heading">
        <h2 id="crops-heading" className="text-lg font-semibold">
          2. Crops
        </h2>

        {rows.length > 0 && (
          <ul className="mt-3 space-y-4">
            {rows.map((r, i) => (
              <li
                key={r.key}
                data-testid={`crop-row-${r.id}`}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm">Re-sow every (days)</span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={r.interval}
                      data-testid={`interval-${r.id}`}
                      onChange={(e) => updateRow(r.key, { interval: e.target.value })}
                      className={numCls + " mt-1"}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm">Successions</span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={r.count}
                      data-testid={`count-${r.id}`}
                      onChange={(e) => updateRow(r.key, { count: e.target.value })}
                      className={numCls + " mt-1"}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  aria-expanded={r.adjust}
                  data-testid={`adjust-toggle-${r.id}`}
                  onClick={() => updateRow(r.key, { adjust: !r.adjust })}
                  className="mt-3 text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
                >
                  {r.adjust ? "Hide offsets" : "Adjust offsets"}
                </button>
                {r.adjust && (
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label className="block">
                      <span className="text-sm">Sow offset (days from last frost)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={r.sowOffset}
                        data-testid={`sow-offset-${r.id}`}
                        onChange={(e) => updateRow(r.key, { sowOffset: e.target.value })}
                        className={numCls + " mt-1"}
                      />
                    </label>
                    <div>
                      <span className="text-sm">Transplant after (days)</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={r.transplantAfter}
                        disabled={r.directSow}
                        data-testid={`transplant-after-${r.id}`}
                        onChange={(e) => updateRow(r.key, { transplantAfter: e.target.value })}
                        className={numCls + " mt-1 disabled:opacity-40"}
                      />
                      <label className="mt-1.5 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={r.directSow}
                          onChange={(e) => updateRow(r.key, { directSow: e.target.checked })}
                          className="h-4 w-4"
                        />
                        Direct-sow (no transplant)
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-sm">Days to harvest</span>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={r.daysToHarvest}
                        data-testid={`days-to-harvest-${r.id}`}
                        onChange={(e) => updateRow(r.key, { daysToHarvest: e.target.value })}
                        className={numCls + " mt-1"}
                      />
                    </label>
                  </div>
                )}
                {(() => {
                  const p = rowProblem(rows[i]);
                  return p ? <p className="mt-2 text-sm text-red-600">{p}</p> : null;
                })()}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-sm font-medium">Add a crop:</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {CROPS.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`add-${c.id}`}
              onClick={() => addCrop(c.id)}
              className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm hover:border-emerald-500 hover:bg-emerald-50 dark:border-gray-600 dark:hover:bg-emerald-950"
            >
              + {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="share-heading">
        <h2 id="share-heading" className="text-lg font-semibold">
          3. Your plan
        </h2>
        {query ? (
          <>
            <CopyField
              label="Printable week-by-week plan"
              value={planUrl}
              testId="plan-url"
              hint="open and print, or share"
            />
            <p className="mt-1 text-sm">
              <a
                href={`/plan?${query}`}
                data-testid="open-plan-link"
                className="font-medium text-emerald-700 underline dark:text-emerald-400"
              >
                Open the plan
              </a>
            </p>
            <CopyField
              label="Calendar feed URL (.ics)"
              value={feedUrl}
              testId="feed-url"
              hint='Google Calendar: Other calendars → + → "From URL"'
            />
            <CopyField
              label="Apple Calendar (webcal)"
              value={webcalUrl}
              testId="webcal-url"
              hint="Apple Calendar: File → New Calendar Subscription"
            />
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Subscribe (don&apos;t import) and your calendar will pick up edits to the plan
              URL automatically. Nothing is stored on a server — every date is computed from
              the URL itself.
            </p>
          </>
        ) : (
          <ul className="mt-3 list-inside list-disc rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
