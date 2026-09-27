/** Enterprise-standard date formatters for the admin panel. */

/** "09-20-26 2:30 AM" — compact datetime with time */
export function fmtDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const mm  = String(d.getMonth() + 1).padStart(2, "0");
  const dd  = String(d.getDate()).padStart(2, "0");
  const yy  = String(d.getFullYear()).slice(2);
  let   hrs = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  return `${mm}-${dd}-${yy} ${hrs}:${min} ${ampm}`;
}

/** "09-20-26" — date only */
export function fmtDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}-${dd}-${yy}`;
}
