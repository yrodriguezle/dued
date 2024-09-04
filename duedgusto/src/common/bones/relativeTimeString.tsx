const minute = 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
const month = day * 30;
const year = day * 365;

/**
 * Convert a date to a relative time string, such as
 * "a minute ago", "in 2 hours", "yesterday", "3 months ago", etc.
 */
export function relativeTimeString(
  date: Date | number,
  lang = navigator.language,
): string {
  const time = date instanceof Date ? date.getTime() : date;
  const delta = Math.round((time - Date.now()) / 1000);
  const absoluteDelta = Math.abs(delta);
  const times: [number, Intl.RelativeTimeFormatUnit, number][] = [
    [minute, "second", 1],
    [hour, "minute", minute],
    [day, "hour", hour],
    [week, "day", day],
    [month, "week", week],
    [year, "month", month],
    [Infinity, "year", year],
  ];
  let divider = year;
  let timeType: Intl.RelativeTimeFormatUnit = "year";
  for (const [num, timeInterval, div] of times) {
    if (absoluteDelta < num) {
      divider = div;
      timeType = timeInterval;
      break;
    }
  }
  const rtf = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
    style: 'narrow',
  });

  return rtf.format(Math.floor(delta / divider), timeType);
}

export default relativeTimeString;
