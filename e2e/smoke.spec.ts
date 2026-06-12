import { expect, test } from "@playwright/test";

const QS = "lf=2026-05-15&ff=2026-10-05&crops=lettuce:14:2:-28:14:55";

test("builder: enter frost dates, add a crop, get plan + feed URLs", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lf-input").fill("2026-05-15");
  await page.getByTestId("ff-input").fill("2026-10-05");
  await page.getByTestId("add-lettuce").click();

  const feedUrl = await page.getByTestId("feed-url").inputValue();
  expect(feedUrl).toContain("/api/feed.ics?lf=2026-05-15&ff=2026-10-05&crops=lettuce:");
  const planUrl = await page.getByTestId("plan-url").inputValue();
  expect(planUrl).toContain("/plan?lf=2026-05-15");
  const webcalUrl = await page.getByTestId("webcal-url").inputValue();
  expect(webcalUrl).toMatch(/^webcal:\/\//);
});

test("builder: shared link prefills the form and preserves the override trio", async ({ page }) => {
  await page.goto(`/?${QS}`);
  await expect(page.getByTestId("lf-input")).toHaveValue("2026-05-15");
  await expect(page.getByTestId("ff-input")).toHaveValue("2026-10-05");
  await expect(page.getByTestId("interval-lettuce")).toHaveValue("14");
  await expect(page.getByTestId("count-lettuce")).toHaveValue("2");
  const feedUrl = await page.getByTestId("feed-url").inputValue();
  expect(feedUrl).toContain("crops=lettuce:14:2:-28:14:55");
});

test("plan page: week headings, tasks, edit link", async ({ page }) => {
  await page.goto(`/plan?${QS}`);
  await expect(
    page.getByRole("heading", { name: "Week of April 13, 2026" })
  ).toBeVisible();
  await expect(page.getByText("Sow Lettuce #1", { exact: true })).toBeVisible();
  const editHref = await page.getByTestId("edit-plan-link").getAttribute("href");
  expect(editHref).toBe(`/?${QS}`);
});

test("feed: valid deterministic ICS with correct headers", async ({ request }) => {
  const res1 = await request.get(`/api/feed.ics?${QS}`);
  expect(res1.status()).toBe(200);
  expect(res1.headers()["content-type"]).toContain("text/calendar");
  expect(res1.headers()["cache-control"]).toBe("public, max-age=3600");
  const body1 = await res1.text();
  expect(body1.match(/BEGIN:VEVENT/g)).toHaveLength(6);
  expect(body1).toContain("UID:sow-lettuce-1@sowcal");

  const res2 = await request.get(`/api/feed.ics?${QS}`);
  expect(await res2.text()).toBe(body1);
});

test("feed: bad input returns 400, not 500", async ({ request }) => {
  const bad = await request.get("/api/feed.ics?lf=notadate&crops=lettuce:14:2");
  expect(bad.status()).toBe(400);
  expect(await bad.text()).toContain("lf");
});
