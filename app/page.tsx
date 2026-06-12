import Builder, { BuilderInitial, BuilderRow } from "./Builder";
import { CROPS_BY_ID, titleizeId } from "@/lib/crops";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INT_RE = /^-?\d+$/;

/** Lenient prefill: parse what we can from a shared link, skip what we can't. */
function prefillRows(cropsParam: string): BuilderRow[] {
  const rows: BuilderRow[] = [];
  const specs = cropsParam.split(",").map((s) => s.trim()).filter(Boolean);
  specs.forEach((spec, i) => {
    const parts = spec.split(":");
    if (parts.length !== 3 && parts.length !== 6) return;
    const id = parts[0].toLowerCase();
    const defaults = CROPS_BY_ID.get(id);
    if (!defaults && parts.length !== 6) return;
    if (!INT_RE.test(parts[1]) || !INT_RE.test(parts[2])) return;

    let sowOffset: string;
    let directSow: boolean;
    let transplantAfter: string;
    let daysToHarvest: string;
    let adjust = false;

    if (parts.length === 6) {
      if (!INT_RE.test(parts[3]) || !INT_RE.test(parts[5])) return;
      if (parts[4] !== "-" && !INT_RE.test(parts[4])) return;
      sowOffset = parts[3];
      directSow = parts[4] === "-";
      transplantAfter = directSow ? "21" : parts[4];
      daysToHarvest = parts[5];
      adjust = true;
    } else {
      sowOffset = String(defaults!.sowOffset);
      directSow = defaults!.transplantAfter === null;
      transplantAfter = directSow ? "21" : String(defaults!.transplantAfter);
      daysToHarvest = String(defaults!.daysToHarvest);
    }

    rows.push({
      key: `init-${i}-${id}`,
      id,
      name: defaults ? defaults.name : titleizeId(id),
      interval: parts[1],
      count: parts[2],
      adjust,
      sowOffset,
      directSow,
      transplantAfter,
      daysToHarvest,
    });
  });
  return rows;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const lf = first(sp.lf);
  const ff = first(sp.ff);
  const initial: BuilderInitial = {
    lf: DATE_RE.test(lf) ? lf : "",
    ff: DATE_RE.test(ff) ? ff : "",
    rows: prefillRows(first(sp.crops)),
  };
  return <Builder initial={initial} />;
}
