import { describe, expect, it } from "vitest";
import { SIDEBAR_BOTTOM, SIDEBAR_TOP } from "../constants";
import { SIDEBAR_ICON_MAP } from "../components/sidebarIcons";

// Review-agy F1 regression guard: AppShell crashed app-wide when
// constants.ts grew a sidebar entry whose icon name had no component
// in the icon map (AudioLines). Every entry must resolve.
describe("sidebar icon coverage", () => {
  it("resolves every SIDEBAR_TOP/SIDEBAR_BOTTOM icon name to a component", () => {
    for (const item of [...SIDEBAR_TOP, ...SIDEBAR_BOTTOM]) {
      expect(SIDEBAR_ICON_MAP[item.icon], `missing icon for "${item.icon}" (${item.state})`).toBeDefined();
    }
  });
});
