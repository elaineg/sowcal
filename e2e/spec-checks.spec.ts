// One e2e test per APP_SPEC.md success check, runnable against any deployment:
//   E2E_BASE_URL=https://<deployment> npm run test:e2e
import { expect, test } from "@playwright/test";

const QS = "lf=2026-05-15&ff=2026-10-05&crops=lettuce:14:2:-28:14:55";

test("check 1: lettuce feed — 200, text/calendar, 6 VEVENTs, exact dates and SUMMARYs", async ({ request }) => {
  const res = await request.get(`/api/feed.ics?${QS}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const body = await res.text();
  expect(body.startsWith("BEGIN:VCALENDAR")).toBe(true);
  expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(6);

  // every event is all-day
  expect(body.match(/DTSTART;VALUE=DATE:\d{8}/g)).toHaveLength(6);
  const expected: Array<[string, string]> = [
    ["Sow Lettuce #1", "20260417"],
    ["Sow Lettuce #2", "20260501"],
    ["Transplant Lettuce #1", "20260501"],
    ["Transplant Lettuce #2", "20260515"],
    ["Harvest Lettuce #1", "20260611"],
    ["Harvest Lettuce #2", "20260625"],
  ];
  const events = body.split("BEGIN:VEVENT").slice(1);
  for (const [summary, date] of expected) {
    const ev = events.find((e) => e.includes(`SUMMARY:${summary}\r\n`));
    expect(ev, `event "${summary}" present`).toBeDefined();
    expect(ev!).toContain(`DTSTART;VALUE=DATE:${date}`);
  }
});

test("check 2: direct-sow carrot — 6 VEVENTs, no Transplant SUMMARY, sow span 20260515..20260626", async ({ request }) => {
  const res = await request.get(
    "/api/feed.ics?lf=2026-05-15&ff=2026-10-05&crops=carrot:21:3:0:-:70"
  );
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(6);
  expect(body).not.toContain("SUMMARY:Transplant");
  expect(body.match(/SUMMARY:Sow Carrot #\d/g)).toHaveLength(3);
  expect(body.match(/SUMMARY:Harvest Carrot #\d/g)).toHaveLength(3);
  const sows = events(body).filter((e) => e.includes("SUMMARY:Sow"));
  expect(sows[0]).toContain("DTSTART;VALUE=DATE:20260515");
  expect(sows[sows.length - 1]).toContain("DTSTART;VALUE=DATE:20260626");
});

test("check 3: determinism — byte-identical bodies, UIDs match <type>-<crop>-<n>@sowcal", async ({ request }) => {
  const body1 = await (await request.get(`/api/feed.ics?${QS}`)).text();
  const body2 = await (await request.get(`/api/feed.ics?${QS}`)).text();
  expect(body2).toBe(body1);
  const uids = [...body1.matchAll(/UID:(\S+)/g)].map((m) => m[1]);
  expect(uids).toHaveLength(6);
  for (const uid of uids) {
    expect(uid).toMatch(/^(sow|transplant|harvest)-[a-z0-9-]+-\d+@sowcal$/);
  }
  expect(new Set(uids).size).toBe(6);
});

test("check 4: cache headers — Cache-Control public, max-age=3600 (CDN strips Vercel-CDN-Cache-Control from client responses; route-set value is asserted by tests/ics + local run)", async ({ request }) => {
  const res = await request.get(`/api/feed.ics?${QS}`);
  expect(res.headers()["cache-control"]).toBe("public, max-age=3600");
  // When running against localhost (no CDN), the route's CDN header is visible:
  if (!process.env.E2E_BASE_URL) {
    expect(res.headers()["vercel-cdn-cache-control"]).toBe("public, s-maxage=3600");
  }
});

test("check 5: frost-risk suffix on harvest #2 only when past ff", async ({ request }) => {
  const res = await request.get(
    "/api/feed.ics?lf=2026-05-15&ff=2026-06-20&crops=lettuce:14:2:-28:14:55"
  );
  const body = await res.text();
  expect(body).toContain("SUMMARY:Harvest Lettuce #1\r\n");
  expect(body).toContain("SUMMARY:Harvest Lettuce #2 (frost risk)\r\n");
});

test("check 6: /plan — Week of April 13 heading, Sow Lettuce #1 task, edit link, print CSS", async ({ page }) => {
  await page.goto(`/plan?${QS}`);
  const heading = page.getByRole("heading", { name: "Week of April 13, 2026" });
  await expect(heading).toBeVisible();
  await expect(page.getByText("Sow Lettuce #1", { exact: true })).toBeVisible();
  const editHref = await page.getByTestId("edit-plan-link").getAttribute("href");
  expect(editHref).toBe(`/?${QS}`);
  // @media print stylesheet hides nav/edit controls:
  const printCss = await page.evaluate(() => {
    let found = "";
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule && rule.media.mediaText.includes("print")) {
          found += rule.cssText + "\n";
        }
      }
    }
    return found;
  });
  expect(printCss).toContain("print");
  expect(printCss).toMatch(/display:\s*none/);
  // and the edit link is actually hidden under print media:
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("edit-plan-link")).toBeHidden();
  await expect(heading).toBeVisible(); // content still prints
});

test("check 7: / prefills from query string and shows feed URL with override trio", async ({ page }) => {
  await page.goto(`/?${QS}`);
  await expect(page.getByTestId("lf-input")).toHaveValue("2026-05-15");
  await expect(page.getByTestId("ff-input")).toHaveValue("2026-10-05");
  await expect(page.getByTestId("interval-lettuce")).toHaveValue("14");
  await expect(page.getByTestId("count-lettuce")).toHaveValue("2");
  const feedUrl = await page.getByTestId("feed-url").inputValue();
  expect(feedUrl).toContain("crops=lettuce:14:2:-28:14:55");
});

test("check 8: malformed lf and unknown crop id both 400 with the field named", async ({ request }) => {
  const badDate = await request.get("/api/feed.ics?lf=notadate&crops=lettuce:14:2");
  expect(badDate.status()).toBe(400);
  expect(await badDate.text()).toContain("lf");

  const badCrop = await request.get(
    "/api/feed.ics?lf=2026-05-15&ff=2026-10-05&crops=quinoa:14:2"
  );
  expect(badCrop.status()).toBe(400);
  expect(await badCrop.text()).toContain("quinoa");
});

test("ICS validity: CRLF-only line endings, 75-octet folding, required properties", async ({ request }) => {
  const body = await (await request.get(`/api/feed.ics?${QS}`)).text();
  expect(body.replace(/\r\n/g, "")).not.toContain("\n");
  expect(body.replace(/\r\n/g, "")).not.toContain("\r");
  for (const line of body.split("\r\n")) {
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  }
  expect(body).toContain("VERSION:2.0\r\n");
  expect(body).toMatch(/PRODID:/);
  for (const ev of events(body)) {
    expect(ev).toMatch(/UID:/);
    expect(ev).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ev).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
    expect(ev).toMatch(/SUMMARY:/);
  }
});

function events(body: string): string[] {
  return body
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((e) => e.split("END:VEVENT")[0]);
}
