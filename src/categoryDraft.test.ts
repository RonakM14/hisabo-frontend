import { describe, it, expect } from "vitest";
import { prepareCategorySave } from "./categoryDraft";
const existing = [
  { id: "FOOD", label: "Food", color: "#123abc", active: true },
];
describe("category save drafts", () => {
  it("includes a pending new category when Save is clicked directly", () => {
    const result = prepareCategorySave(existing, " Travel ", "#abcdef");
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      label: "Travel",
      color: "#abcdef",
      active: true,
    });
    expect(result[1].id).toMatch(/^CUSTOM_[a-f0-9-]{36}$/);
    expect(existing).toHaveLength(1);
    expect(prepareCategorySave(result)).toEqual(result);
  });
  it("saves edited names without adding an empty category", () => {
    expect(
      prepareCategorySave([{ ...existing[0], label: " Groceries " }], " "),
    ).toEqual([{ ...existing[0], label: "Groceries" }]);
  });
  it("rejects duplicate names, including removed and Unicode-equivalent names", () => {
    expect(() => prepareCategorySave(existing, "ＦＯＯＤ")).toThrow(
      "already exists",
    );
    expect(() =>
      prepareCategorySave([{ ...existing[0], active: false }], "food"),
    ).toThrow("already exists");
  });
  it("rejects blank or invalid edited names before submitting", () => {
    for (const label of [" ", "a".repeat(41), "bad\nname"]) {
      expect(() => prepareCategorySave([{ ...existing[0], label }])).toThrow(
        "1–40",
      );
    }
  });
});
