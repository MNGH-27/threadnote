/** Refresh an enabled startup entry after upgrades without re-enabling an opt-out. */
export async function reconcileAutostart(
  configured: boolean,
  isEnabled: () => Promise<boolean>,
  enable: () => Promise<void>,
  markConfigured: () => void,
) {
  const active = await isEnabled();
  if (active || !configured) await enable();
  markConfigured();
}
