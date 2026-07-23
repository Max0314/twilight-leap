import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the Fribench game deployment private and isolated", async () => {
  const [compose, dockerfile, hostNginx] = await Promise.all([
    readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL("Dockerfile", root), "utf8"),
    readFile(new URL("deploy/host-nginx.conf.example", root), "utf8"),
  ]);

  assert.match(compose, /^name: fribench-twilight-leap$/m);
  assert.match(compose, /127\.0\.0\.1:\$\{TWILIGHT_LEAP_PORT:-23002\}:8080/);
  assert.match(compose, /name: fribench-twilight-leap-edge-v1/);
  assert.match(compose, /NPM_REGISTRY:-https:\/\/registry\.npmmirror\.com/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /cap_drop:\s+- ALL/);
  assert.match(compose, /mem_limit: 128m/);
  assert.doesNotMatch(compose, /fribench-backend/);
  assert.doesNotMatch(compose, /0\.0\.0\.0/);

  assert.match(dockerfile, /FROM node:24\.18\.0-alpine AS dependencies/);
  assert.match(dockerfile, /FROM nginx:1\.28\.3-alpine AS runtime/);
  assert.match(
    dockerfile,
    /--mount=type=cache,id=twilight-leap-npm,target=\/root\/\.npm,sharing=locked/,
  );
  assert.match(hostNginx, /proxy_pass http:\/\/127\.0\.0\.1:23002/);
});
