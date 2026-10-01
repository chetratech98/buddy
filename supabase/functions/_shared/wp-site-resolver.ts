/**
 * Resolves which WordPress credentials a post should publish with.
 *
 * wordpress_sites (multi-site support, /settings/sites UI) has existed
 * since the multi-tenancy migration, but nothing in the publish pipeline
 * ever read from it — every publish silently used the single legacy
 * profiles.wp_url fields regardless of what was configured there. This
 * resolver is the fix: it tries, in order of specificity,
 *   1. an explicit per-post wordpress_site_id (for a future site-picker UI)
 *   2. the org/user's default wordpress_sites row (is_default = true) —
 *      this makes the already-built "Set as default" button in
 *      Settings > Sites the real, functioning control surface
 *   3. the legacy profiles.wp_url/wp_username/wp_app_password[_enc] fields,
 *      for anyone who only ever used the Profile page's single-site form
 * and returns null only if none of the three has anything configured.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type WpCredentialProfile, hasWordPressCredentials } from "./wp-crypto.ts";

export interface ResolvedWpSite extends WpCredentialProfile {
  /** "site" when resolved from wordpress_sites, "legacy" from profiles — for logging. */
  source: "site" | "legacy";
  siteName?: string;
}

export async function resolveWpSiteCredentials(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  params: { userId: string; orgId?: string | null; siteId?: string | null }
): Promise<ResolvedWpSite | null> {
  const { userId, orgId, siteId } = params;

  // Tier 1: explicit per-post site.
  if (siteId) {
    const { data: site } = await supabase
      .from("wordpress_sites")
      .select("name, wp_url, wp_username, wp_app_password_enc")
      .eq("id", siteId)
      .single();
    if (site && hasWordPressCredentials(site)) {
      return { ...site, source: "site", siteName: site.name };
    }
  }

  // Tier 2: the org/user's default site.
  let defaultQuery = supabase
    .from("wordpress_sites")
    .select("name, wp_url, wp_username, wp_app_password_enc")
    .eq("is_default", true);
  defaultQuery = orgId
    ? defaultQuery.eq("org_id", orgId)
    : defaultQuery.eq("user_id", userId).is("org_id", null);
  const { data: defaultSite } = await defaultQuery.maybeSingle();
  if (defaultSite && hasWordPressCredentials(defaultSite)) {
    return { ...defaultSite, source: "site", siteName: defaultSite.name };
  }

  // Tier 3: legacy single-site profile fields.
  const { data: profile } = await supabase
    .from("profiles")
    .select("wp_url, wp_username, wp_app_password_enc, wp_app_password")
    .eq("user_id", userId)
    .single();
  if (profile && hasWordPressCredentials(profile)) {
    return { ...profile, source: "legacy" };
  }

  return null;
}
