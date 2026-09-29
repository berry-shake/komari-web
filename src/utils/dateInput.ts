// A date input represents a calendar date, not a UTC instant. Keep the date
// from server timestamps; use local calendar fields for browser-created dates.
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (typeof value === "string") {
    return value.match(/^\d{4}-\d{2}-\d{2}(?=$|T| )/)?.[0] ?? "";
  }
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return "";
  const year = value.getFullYear().toString().padStart(4, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The API interprets timezone-less timestamps in the application's timezone.
// A date-only billing selection remains valid through the end of that day.
export function billingExpiryFromDate(value: string): string {
  return value ? `${value} 23:59:59` : "";
}
