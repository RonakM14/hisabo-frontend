import type { BudgetCategory } from "./types";

const normalizedName = (value: string) => value.normalize("NFKC").trim();

export function prepareCategorySave(
  entries: BudgetCategory[],
  pendingName = "",
  color = "#34b4a4",
): BudgetCategory[] {
  const result = entries.map((c) => ({ ...c, label: normalizedName(c.label) }));
  const label = normalizedName(pendingName);
  if (label) {
    if (result.length >= 200)
      throw new Error(
        "This profile has reached its limit of 200 categories, including removed categories.",
      );
    result.push({
      id: `CUSTOM_${crypto.randomUUID()}`,
      label,
      color,
      active: true,
    });
  }
  const names = new Set<string>();
  for (const category of result) {
    if (
      !category.label ||
      category.label.length > 40 ||
      /[\p{Cc}\p{Cf}\uFFFE\uFFFF]/u.test(category.label)
    )
      throw new Error(
        "Category names must contain 1–40 characters without control characters.",
      );
    const key = category.label.toLowerCase();
    if (names.has(key))
      throw new Error(
        `“${category.label}” already exists. Use a different name or restore the removed category.`,
      );
    names.add(key);
  }
  return result;
}
