/// <reference types="node" />
import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";

const ROOT = path.resolve(__dirname, "..");

describe("Route parameter guards", () => {
  it("CaseDetailPage does not use non-null assertion on id", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src/pages/CaseDetailPage.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/useCase\(id!\)/);
    expect(source).not.toMatch(/useRelatedCases\(id!\)/);
  });

  it("CaseEditPage does not use non-null assertion on id", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src/pages/CaseEditPage.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/useCase\(id!\)/);
  });

  it("CaseDetailPage contains Navigate guard for missing id", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/pages/CaseDetailPage.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/if \(!id\)/);
    expect(source).toMatch(/Navigate to="\/cases"/);
  });

  it("CaseEditPage contains Navigate guard for missing id", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/pages/CaseEditPage.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/if \(!id\)/);
    expect(source).toMatch(/Navigate to="\/cases"/);
  });
});
