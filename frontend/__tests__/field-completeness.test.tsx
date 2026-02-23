import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Court options completeness", () => {
  const editSource = fs.readFileSync(
    path.resolve(__dirname, "../src/pages/CaseEditPage.tsx"),
    "utf-8",
  );
  const addSource = fs.readFileSync(
    path.resolve(__dirname, "../src/pages/CaseAddPage.tsx"),
    "utf-8",
  );

  it("CaseEditPage COURT_OPTIONS includes all 9 courts", () => {
    for (const court of ["AATA", "ARTA", "FCA", "FCCA", "FedCFamC2G", "HCA", "FMCA", "MRTA", "RRTA"]) {
      expect(editSource).toContain(`"${court}"`);
    }
  });

  it("CaseAddPage COURT_OPTIONS includes all 9 courts", () => {
    for (const court of ["AATA", "ARTA", "FCA", "FCCA", "FedCFamC2G", "HCA", "FMCA", "MRTA", "RRTA"]) {
      expect(addSource).toContain(`"${court}"`);
    }
  });

  it("CaseEditPage EDITABLE_FIELDS includes year", () => {
    expect(editSource).toMatch(/"year"/);
  });
});

describe("SPA Link usage in CollectionsPage", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/pages/CollectionsPage.tsx"),
    "utf-8",
  );

  it("uses Link instead of a href for case navigation", () => {
    expect(source).not.toContain('href={`/app/cases/');
    expect(source).not.toContain('href={`/cases/');
  });
});
