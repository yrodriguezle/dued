const numberParser = (string: string, locale: string = "en-US"): number => {
  const format = new Intl.NumberFormat(locale);
  const parts = format.formatToParts(12345.6);
  const numerals = Array.from({ length: 10 }).map((_, i) => format.format(i));
  const ind = new Map(numerals.map((d, i) => [d, i]));
  const group = new RegExp(`[${parts.find((d) => d.type === "group")?.value}]`, "g");
  const decimal = new RegExp(`[${parts.find((d) => d.type === "decimal")?.value}]`);
  const numeral = new RegExp(`[${numerals.join("")}]`, "g");
  const index = (d: string) => {
    const result = ind.get(d);
    return typeof result === "string" ? result : "";
  };

  const result = string.trim()
    .replace(group, "")
    .replace(decimal, ".")
    .replace(numeral, index);
  return result ? +result : 0;
};

export default numberParser;
