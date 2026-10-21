/** Reject non-web protocols and embedded credentials before opening native content. */
export function normalizeWebsite(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  // A scheme must never be disguised as part of an HTTPS hostname.
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    )
      return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
