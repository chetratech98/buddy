/**
 * Shared WordPress application-password resolution — decrypts the AES-GCM
 * encrypted column written by save-wordpress-credentials, falling back to
 * the legacy plaintext column for older rows that predate encryption.
 *
 * Used by both publish-to-wordpress (interactive) and scheduled-publisher
 * (cron) so the two never drift out of sync on how a password is resolved.
 */

export interface WpCredentialProfile {
  wp_url?: string | null;
  wp_username?: string | null;
  wp_app_password_enc?: string | null;
  wp_app_password?: string | null;
}

async function decryptPassword(encryptedBase64: string, keyStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(keyStr.padEnd(32, "0").slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
  );
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

/**
 * Resolves the WordPress application password for a profile, preferring the
 * encrypted column and falling back to legacy plaintext. Returns null if
 * neither is present, or if decryption fails (e.g. missing/rotated key).
 */
export async function resolveWpPassword(
  profile: WpCredentialProfile,
  encryptionKey: string | undefined
): Promise<{ password: string } | { error: string }> {
  if (profile.wp_app_password_enc) {
    if (!encryptionKey) return { error: "WP_ENCRYPTION_KEY not configured on the server" };
    try {
      return { password: await decryptPassword(profile.wp_app_password_enc, encryptionKey) };
    } catch {
      return { error: "Failed to decrypt WordPress credentials. Please re-save your WordPress settings." };
    }
  }
  if (profile.wp_app_password) {
    return { password: profile.wp_app_password };
  }
  return { error: "WordPress credentials not configured." };
}

/** True when a profile has everything needed to publish to WordPress. */
export function hasWordPressCredentials(profile: WpCredentialProfile): boolean {
  return Boolean(profile.wp_url && profile.wp_username && (profile.wp_app_password_enc || profile.wp_app_password));
}
