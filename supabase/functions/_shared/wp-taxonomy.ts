/**
 * Resolves plain category/tag names (what blog_posts.category/tags store)
 * into WordPress taxonomy term IDs (what the WP REST API's posts.categories
 * /posts.tags fields actually need) — searching for an existing term by
 * name first, creating it if none exists. Never throws: a failed lookup or
 * create for one term is skipped rather than blocking the whole publish.
 */

type WpTaxonomy = "categories" | "tags";

async function resolveOneTerm(
  name: string,
  taxonomy: WpTaxonomy,
  wpUrl: string,
  authHeader: string
): Promise<number | null> {
  const base = `${wpUrl.replace(/\/$/, "")}/wp-json/wp/v2/${taxonomy}`;

  try {
    // Search is fuzzy (substring/relevance), so verify an exact,
    // case-insensitive name match rather than trusting the first result.
    const searchRes = await fetch(`${base}?search=${encodeURIComponent(name)}&per_page=100`, {
      headers: { Authorization: authHeader },
    });
    if (searchRes.ok) {
      const results = await searchRes.json();
      const exact = Array.isArray(results)
        ? results.find((t: { id: number; name: string }) => t.name?.toLowerCase() === name.toLowerCase())
        : null;
      if (exact) return exact.id;
    }

    const createRes = await fetch(base, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (createRes.ok) {
      const created = await createRes.json();
      return typeof created.id === "number" ? created.id : null;
    }
    // Most likely cause of a non-ok create: a term with this name already
    // exists but wasn't an exact match in search results (e.g. WordPress's
    // own slug-collision rules) — not worth a second round-trip for.
    console.warn(`[wp-taxonomy] Failed to resolve "${name}" in ${taxonomy}: HTTP ${createRes.status}`);
    return null;
  } catch (e) {
    console.warn(`[wp-taxonomy] Error resolving "${name}" in ${taxonomy}:`, e);
    return null;
  }
}

/** Resolves a list of plain names into WP term IDs, deduped, skipping empties. */
export async function resolveWpTermIds(
  names: string[] | null | undefined,
  taxonomy: WpTaxonomy,
  wpUrl: string,
  wpUsername: string,
  wpAppPassword: string
): Promise<number[]> {
  const unique = [...new Set((names ?? []).map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const authHeader = `Basic ${btoa(`${wpUsername}:${wpAppPassword}`)}`;
  const ids = await Promise.all(unique.map((name) => resolveOneTerm(name, taxonomy, wpUrl, authHeader)));
  return ids.filter((id): id is number => id !== null);
}
