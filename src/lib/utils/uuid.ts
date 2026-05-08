/**
 * Browser-safe UUID v4 generator.
 *
 * `crypto.randomUUID()` only exists in **secure contexts** (HTTPS or localhost),
 * which means it throws when the dev server is accessed over LAN IP / plain HTTP.
 * `crypto.getRandomValues()` has no such restriction, so we build a v4 UUID by
 * hand from 16 random bytes when `randomUUID` isn't available.
 */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID()
    } catch {
      // Fall through to the manual path on environments that throw (insecure context).
    }
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
  }
  // Last-resort fallback (no Web Crypto at all). Not cryptographically strong, but
  // a `splitGroupId` is just a correlation key — uniqueness within a single user
  // session is enough.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`
}
