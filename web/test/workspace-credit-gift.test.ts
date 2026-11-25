import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("workspace credit mark", () => {
    test("workspace balances use the shared lightning mark", () => {
        const topBar = readFileSync(resolve(import.meta.dir, "../src/components/layout/workspace-top-bar.tsx"), "utf8");
        const canvas = readFileSync(resolve(import.meta.dir, "../src/pages/canvas/canvas-project-top-bar.tsx"), "utf8");
        const credits = readFileSync(resolve(import.meta.dir, "../src/constant/credits.tsx"), "utf8");
        const sharedMark = readFileSync(resolve(import.meta.dir, "../src/components/layout/workspace-credit-mark.tsx"), "utf8");
        const mark = readFileSync(resolve(import.meta.dir, "../src/components/layout/workspace-credit-gift-mark.tsx"), "utf8");
        const css = readFileSync(resolve(import.meta.dir, "../src/styles/globals.css"), "utf8");

        expect(topBar).toContain('<WorkspaceCreditMark className="is-compact" />');
        expect(topBar).not.toContain("useThemePack()?.creditMark");
        expect(canvas).toContain('<WorkspaceCreditMark className="is-compact" />');
        expect(canvas).not.toContain("Coins");
        expect(credits).toContain("<Zap");
        expect(sharedMark).toContain('<Zap fill="currentColor" />');
        expect(mark).toContain("<WorkspaceCreditMark");
        expect(css).toContain(".app-workspace-credit-mark");
    });
});
