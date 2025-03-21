function relativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat("it", {
    numeric: "auto",
    style: "long",
  });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, "second");
  }
  if (diffInSeconds < 3600) {
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    return rtf.format(-diffInMinutes, "minute");
  }
  if (diffInSeconds < 86400) {
    const diffInHours = Math.floor(diffInSeconds / 3600);
    return rtf.format(-diffInHours, "hour");
  }
  if (diffInSeconds < 604800) {
    const diffInDays = Math.floor(diffInSeconds / 86400);
    return rtf.format(-diffInDays, "day");
  }
  if (diffInSeconds < 2419200) {
    const diffInWeeks = Math.floor(diffInSeconds / 604800);
    return rtf.format(-diffInWeeks, "week");
  }
  return rtf.format(-diffInSeconds, "second");
}

export default relativeTime;
