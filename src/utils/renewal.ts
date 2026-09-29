const DAY_MS = 24 * 60 * 60 * 1000;

export function isRenewalDue(expiredAt: string, now = Date.now()): boolean {
  const expiry = Date.parse(expiredAt);
  return expiry >= now && expiry <= now + 7 * DAY_MS;
}

// EditClient stores the provided timestamp directly. LocalTime reads its clock
// fields in the application's timezone, so submit that timezone's wall time
// rather than a UTC ISO string. The API supplies the offset in expired_at.
export function formatRenewalExpiry(date: Date, previousExpiry: string | null | undefined): string | null {
  const zone = previousExpiry?.match(/(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!zone || !Number.isFinite(date.getTime())) return null;
  const minutes = zone[1] === "Z" ? 0
    : (Number(zone[3]) * 60 + Number(zone[4])) * (zone[2] === "+" ? 1 : -1);
  const local = new Date(date.getTime() + minutes * 60_000);
  if (!Number.isFinite(local.getTime())) return null;
  return local.toISOString().slice(0, 19).replace("T", " ");
}

// Match upstream Dashboard's calendar rules for upcoming expirations,
// including native Date month-end/leap-year rollover behavior.
export function computeRenewalDate(
  expiredAt: Date,
  billingCycle: number,
): Date | null {
  if (
    !Number.isFinite(expiredAt.getTime()) ||
    !Number.isSafeInteger(billingCycle) ||
    billingCycle <= 0
  ) return null;

  const result = new Date(expiredAt);
  if (billingCycle >= 27 && billingCycle <= 32) {
    result.setMonth(result.getMonth() + 1);
  } else if (billingCycle >= 87 && billingCycle <= 95) {
    result.setMonth(result.getMonth() + 3);
  } else if (billingCycle >= 175 && billingCycle <= 185) {
    result.setMonth(result.getMonth() + 6);
  } else if (billingCycle >= 360 && billingCycle <= 370) {
    result.setFullYear(result.getFullYear() + 1);
  } else if (billingCycle >= 720 && billingCycle <= 750) {
    result.setFullYear(result.getFullYear() + 2);
  } else if (billingCycle >= 1080 && billingCycle <= 1150) {
    result.setFullYear(result.getFullYear() + 3);
  } else if (billingCycle >= 1800 && billingCycle <= 1850) {
    result.setFullYear(result.getFullYear() + 5);
  } else {
    result.setDate(result.getDate() + billingCycle);
  }
  return Number.isFinite(result.getTime()) ? result : null;
}
