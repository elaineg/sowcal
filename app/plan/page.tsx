import type { Metadata } from "next";
import Link from "next/link";
import {
  formatLong,
  formatShort,
  groupByWeek,
  parsePlanParams,
  planEvents,
  planToQuery,
} from "@/lib/plan";

export const metadata: Metadata = {
  title: "SowCal — week-by-week planting plan",
  description: "Printable week-by-week sow / transplant / harvest task list.",
};

const PRINT_CSS = `
@media print {
  .print-hidden { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
  main { padding: 0 !important; max-width: none !important; }
  h2 { break-after: avoid; }
  section { break-inside: avoid; }
}
`;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const TYPE_STYLES: Record<string, string> = {
  sow: "bg-emerald-100 text-emerald-900",
  transplant: "bg-sky-100 text-sky-900",
  harvest: "bg-amber-100 text-amber-900",
};

export default async function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parsed = parsePlanParams({
    lf: first(sp.lf),
    ff: first(sp.ff),
    crops: first(sp.crops),
  });

  if (!parsed.ok) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold">SowCal plan</h1>
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-800" role="alert">
          {parsed.error}
        </p>
        <p className="mt-4">
          <Link href="/" className="font-medium text-emerald-700 underline">
            Build a plan
          </Link>
        </p>
      </main>
    );
  }

  const plan = parsed.plan;
  const query = planToQuery(plan);
  const events = planEvents(plan);
  const weeks = groupByWeek(events);

  return (
    <main className="mx-auto max-w-2xl p-6 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">SowCal planting plan</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Last spring frost {formatLong(plan.lf)} · First fall frost {formatLong(plan.ff)} ·{" "}
          {plan.crops.length} {plan.crops.length === 1 ? "crop" : "crops"}, {events.length} tasks
        </p>
        <nav className="print-hidden mt-4 flex flex-wrap gap-3">
          <Link
            href={`/?${query}`}
            data-testid="edit-plan-link"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Edit this plan
          </Link>
          <a
            href={`/api/feed.ics?${query}`}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Calendar feed (.ics)
          </a>
        </nav>
      </header>

      {weeks.map((week) => (
        <section key={week.monday} className="mb-6">
          <h2 className="border-b border-gray-300 pb-1 text-lg font-semibold dark:border-gray-600">
            {`Week of ${formatLong(week.monday)}`}
          </h2>
          <ul className="mt-2 space-y-1">
            {week.events.map((ev) => (
              <li key={ev.uid} className="flex items-baseline gap-3 py-1">
                <span className="w-24 shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                  {formatShort(ev.date)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${TYPE_STYLES[ev.type]}`}
                >
                  {ev.type}
                </span>
                <span data-testid="task">{ev.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="print-hidden mt-10 border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        This whole plan lives in the URL — bookmark or share the link to keep it.
      </footer>
    </main>
  );
}
