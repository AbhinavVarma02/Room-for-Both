import { DAY_LABELS, type Day } from "../constants/vocabulary";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function money(value: number): string {
  return usd.format(value);
}

export function hours(value: number): string {
  return `${value} ${value === 1 ? "hour" : "hours"}`;
}

export function weeks(value: number): string {
  return `${value} ${value === 1 ? "week" : "weeks"}`;
}

export function clock(hour: number): string {
  if (hour === 0 || hour === 24) return "12 am";
  if (hour === 12) return "12 pm";
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`;
}

export function windowLabel(day: Day, start: number, end: number): string {
  return `${DAY_LABELS[day]} ${clock(start)}–${clock(end)}`;
}

export function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
