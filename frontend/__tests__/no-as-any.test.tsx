import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("No as-any type casts", () => {
  it("LegislationsPage does not use 'as any'", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/pages/LegislationsPage.tsx"),
      "utf-8",
    );
    const matches = source.match(/as any/g);
    expect(matches).toBeNull();
  });
});
