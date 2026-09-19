const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const money = (n) => usd.format(n);

export const roundCents = (n) => Math.round(n * 100) / 100;

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

// "4pm", "4:30pm"
export function clock(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? "am" : "pm";
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}
