// ICS (RFC 5545) generation. Deterministic: the same plan always produces a
// byte-identical body — DTSTAMP derives from the plan's last-frost date, never "now".

import { addDays, Plan, planEvents } from "./plan";

const encoder = new TextEncoder();

/** Escape TEXT values per RFC 5545 §3.3.11. */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line at 75 octets (UTF-8 safe), continuations prefixed with a space. */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = encoder.encode(ch).length;
    if (curBytes + b > 75) {
      parts.push(cur);
      cur = "";
      curBytes = 1; // leading space on the continuation line
    }
    cur += ch;
    curBytes += b;
  }
  if (cur.length > 0) parts.push(cur);
  return parts.join("\r\n ");
}

function dateValue(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Build the full VCALENDAR body for a plan. CRLF line endings throughout. */
export function buildIcs(plan: Plan): string {
  const events = planEvents(plan);
  // Deterministic DTSTAMP derived from the plan parameters (never from "now"),
  // so calendar re-syncs see an unchanged body and update instead of duplicating.
  const dtstamp = `${dateValue(plan.lf)}T000000Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SowCal//Succession Planting Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:SowCal planting plan",
    "X-WR-CALDESC:Sow / transplant / harvest dates computed from frost dates. " +
      "Edit the URL parameters to change the plan.",
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dateValue(ev.date)}`,
      `DTEND;VALUE=DATE:${dateValue(addDays(ev.date, 1))}`,
      `SUMMARY:${escapeIcsText(ev.summary)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
