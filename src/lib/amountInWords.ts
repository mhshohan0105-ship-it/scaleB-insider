// Amount in words for invoices and receipts, using the South Asian system
// (thousand, lakh, crore): 1,25,550.50 -> "One Lakh Twenty Five Thousand
// Five Hundred Fifty Taka and Fifty Paisa Only".
import Decimal from "decimal.js";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 ? `${t} ${ONES[n % 10]}` : t;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Whole number (as a digit string, any size) in words with crore/lakh/thousand. */
function integerWords(digits: string): string {
  let s = digits.replace(/^0+/, "");
  if (!s) return "Zero";
  const parts: string[] = [];
  // Above 99 crore, the crore count itself is spelled recursively.
  if (s.length > 7) {
    const crore = s.slice(0, -7);
    parts.push(`${integerWords(crore)} Crore`);
    s = s.slice(-7);
  }
  const n = Number(s.padStart(7, "0"));
  const lakh = Math.floor(n / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

export function amountInWords(
  value: Decimal | string | number,
  currency = { major: "Taka", minor: "Paisa" },
): string {
  const v = new Decimal(value.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const [whole, frac = "00"] = v.abs().toFixed(2).split(".");
  const paisa = Number(frac);
  const words = `${integerWords(whole!)} ${currency.major}${paisa ? ` and ${belowHundred(paisa)} ${currency.minor}` : ""} Only`;
  return v.isNegative() && !v.isZero() ? `Minus ${words}` : words;
}
