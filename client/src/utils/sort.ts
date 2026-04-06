/**
 * Reusable, case-insensitive alphabetical sort utility.
 *
 * Uses `localeCompare` for proper Unicode / non-English character handling.
 * Null / undefined names are treated as empty strings so they sort first
 * without crashing.
 */

/**
 * Returns a new array sorted by the `name` property, case-insensitively.
 * The original array is NOT mutated.
 */
export function sortByName<T extends { name?: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const nameA = (a.name ?? "").toLowerCase();
    const nameB = (b.name ?? "").toLowerCase();
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });
}
