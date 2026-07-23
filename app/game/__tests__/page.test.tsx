import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "../../page";

describe("game page", () => {
  it("renders the approved title, mission, and primary action", () => {
    const markup = renderToStaticMarkup(<Home />);
    expect(markup).toContain("暮光跃境");
    expect(markup).toContain("收集星辉");
    expect(markup).toContain("开始旅程");
  });

  it("keeps an accessible sound toggle inside the pause dialog", () => {
    const source = readFileSync(new URL("../../page.tsx", import.meta.url), "utf8");
    const pauseStart = source.indexOf('{screen === "paused" ? (');
    const pauseEnd = source.indexOf('{screen === "finished"', pauseStart);
    const pauseSection = source.slice(pauseStart, pauseEnd);

    expect(pauseSection).toContain("toggleSound");
    expect(pauseSection).toContain("aria-pressed={prefs.sound}");
  });

  it("does not force the game taller than a short landscape viewport", () => {
    const css = readFileSync(new URL("../../globals.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/min-height:\s*(?:420|320)px/);
  });

  it("explains double jump and wall jump in the visible controls", () => {
    const source = readFileSync(new URL("../../page.tsx", import.meta.url), "utf8");
    expect(source).toContain("二段跳");
    expect(source).toContain("蹬墙跳");
  });
});
