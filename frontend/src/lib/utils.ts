import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt12h(val: string): string {
  if (!val) return "";
  const [hStr, mStr] = val.split(":");
  const h24 = parseInt(hStr, 10);
  const m   = parseInt(mStr, 10);
  const period = h24 < 12 ? "AM" : "PM";
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
