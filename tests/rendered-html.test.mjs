import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://127.0.0.1${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Vintex marketing site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vintex .* Android Anticheat for Unity<\/title>/i);
  assert.match(html, /Trust the player/);
  assert.match(html, /Verify the device/);
  assert.match(html, /BankruptGames/);
  assert.match(html, /href="\/dashboard"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("ships the authenticated dashboard and interactive player activity view", async () => {
  const [response, dashboardClient, css] = await Promise.all([
    render("/dashboard"),
    readFile(new URL("../app/dashboard/DashboardClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Dashboard .* Vintex<\/title>/i);
  assert.match(html, /Loading Vintex workspace/);

  assert.match(dashboardClient, /"players"/);
  assert.match(dashboardClient, /Player logins/);
  assert.match(dashboardClient, /player-logins\?limit=500/);
  assert.match(dashboardClient, /setInterval[\s\S]*15_000/);
  assert.match(dashboardClient, /Search player ID, game, or error code/);
  assert.match(dashboardClient, /aria-expanded=\{expanded\}/);
  assert.match(dashboardClient, /\/api\/billing\/config/);
  assert.match(dashboardClient, /\/api\/billing\/studios\/\$\{organization\.id\}\/checkout/);
  assert.match(dashboardClient, /Subscribe/);
  assert.match(dashboardClient, /Setup required/);
  assert.match(dashboardClient, /Stripe setup is incomplete on the server/);
  assert.match(dashboardClient, /creditsIncluded\.toLocaleString\(\)/);
  assert.match(dashboardClient, /Protected products/);
  assert.match(dashboardClient, /Free access/);
  assert.match(css, /\.players-panel/);
  assert.match(css, /\.player-details/);
  assert.match(css, /\.login-status\.allowed/);
  assert.match(css, /\.billing-action/);
});
