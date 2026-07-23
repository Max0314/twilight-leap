import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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

test("server-renders the finished Twilight Leap entry screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>暮光跃境 · Twilight Leap<\/title>/);
  assert.match(html, /穿越余烬古城，在光影交错的原创像素世界中/);
  assert.match(html, /property="og:image" content="https?:\/\/[^\"]+\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /aria-label="暮光跃境游戏画面"/);
  assert.match(html, /TWILIGHT LEAP/);
  assert.match(html, /收集星辉，穿过余烬王庭，抵达星门。/);
  assert.match(html, /开始旅程/);
  assert.doesNotMatch(html, /codex-preview|Codex is working|react-loading-skeleton/i);
});

test("ships production art and removes starter-only files", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<GameCanvas/);
  assert.match(page, /className="touch-controls"/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|_sites-preview/);

  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../dist/client/assets/twilight-leap-atlas.png", import.meta.url)),
    access(new URL("../dist/client/og.png", import.meta.url)),
  ]);
  await Promise.all(
    ["favicon.svg", "file.svg", "globe.svg", "window.svg"].map((name) =>
      assert.rejects(access(new URL(`../dist/client/${name}`, import.meta.url))),
    ),
  );
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
