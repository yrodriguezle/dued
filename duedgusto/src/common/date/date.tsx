import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import weekOfYear from "dayjs/plugin/weekOfYear";
import isoWeek from "dayjs/plugin/isoWeek";
import utc from "dayjs/plugin/utc";

dayjs.extend(customParseFormat);
dayjs.extend(quarterOfYear);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(utc);

const defaultServices = {
  dayjs,
};

export const datePattern = /^([0]?[1-9]|[1|2][0-9]|[3][0|1])[./-]([0]?[1-9]|[1|2][0-9]|[3][0|1])(?<separator>[./-])([0-9]{4}|[0-9]{2})$/;

export const getFormatOfDate = (date: string = ""): string => {
  if (date.split("/").length === 3) {
    return "it";
  }
  if (date.split("-").length === 3) {
    return "en";
  }
  throw new Error("Unknown date format");
};

export const determineDateFormat = (dateString: string) => {
  const isDDMMYYYYWithTime: boolean = /^\d{2}\/\d{2}\/\d{4}( \d{2}:\d{2}:\d{2})?$/.test(dateString);
  if (isDDMMYYYYWithTime) {
    return dateString.includes(":") ? "DD/MM/YYYY HH:mm:ss" : "DD/MM/YYYY";
  }
  const isYYYYMMDDWithTime: boolean = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/.test(dateString);
  if (isYYYYMMDDWithTime) {
    return dateString.includes(":") ? "YYYY-MM-DDTHH:mm:ss" : "YYYY-MM-DD";
  }
  return undefined;
};

export const isValidDate = (date: string | Date, format: string[] = ["YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DD HH:mm", "YYYY-MM-DD", "DD/MM/YYYY"]): boolean => {
  if (!date) {
    return false;
  }
  return dayjs(date, format, true).isValid();
};

export const getFullFormatDate = (validDate: string, format: string): dayjs.Dayjs | undefined => {
  const standardFormat = format.toUpperCase().replace(/G/g, "D").replace(/A/g, "Y");
  if (dayjs(validDate, standardFormat, true).isValid()) {
    return dayjs(validDate, standardFormat);
  }
  return undefined;
};

export const getFormattedDateTime = (date: string): string | null => {
  if (isValidDate(date) && date !== "1899-12-30") {
    const result = dayjs(date).format("DD/MM/YYYY HH:mm");
    return result;
  }
  return null;
};

export const formatDate = (date: string) =>
  isValidDate(date) && !date.startsWith("1899-12-30") && !date.startsWith("1900-01-01") && !date.startsWith("0001-01-01")
    ? dayjs(date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("YYYY-MM-DDT00:00:00")
    : null;

export function formatDateTime(date: Date, locale: string = "it-IT", options?: Intl.DateTimeFormatOptions): string {
  const formatter = new Intl.DateTimeFormat(locale, options);
  return formatter.format(date);
}

export const getCurrentDate = (format = "YYYY-MM-DDT00:00:00", services = defaultServices) => services.dayjs().format(format);

export const getDaysInMonth = (services = defaultServices) => services.dayjs().daysInMonth();

export const getStartOfCurrentQuarter = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().startOf("quarter").format(format);
};

export const getEndOfCurrentQuarter = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().endOf("quarter").format(format);
};

export const getStartOfPreviousQuarter = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().subtract(1, "Q").startOf("quarter").format(format);
};

export const getEndOfPreviousQuarter = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().subtract(1, "Q").endOf("quarter").format(format);
};

export const getEndOfMonth = (monthsToAdd: number, format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().add(monthsToAdd, "months").endOf("month").format(format);
};

export const getStartOfPreviousMonth = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().subtract(1, "months").startOf("month").format(format);
};
export const getEndOfPreviousMonth = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().subtract(1, "months").endOf("month").format(format);
};

export const getStartOfPreviousYear = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().subtract(1, "years").startOf("year").format(format);
};

export const getEndOfPreviousYear = (format = "YYYY-MM-DD", services = defaultServices) => {
  return services.dayjs().subtract(1, "years").endOf("year").format(format);
};

export const formatItalianDate = (date: string, services = defaultServices) => services.dayjs(date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("DD/MM/YYYY");

export const getTimeFromDate = (date: string, services = defaultServices) => (isValidDate(date) ? services.dayjs(date).format("HH:mm") : "00:00");

export const addMilliseconds = ({ date, milliseconds }: { date: string; milliseconds: number }, services = defaultServices) => {
  return services.dayjs(date).add(milliseconds, "milliseconds").format("YYYY-MM-DDTHH:mm:ss");
};

export const isDateBefore = ({ date, threshold }: { date: string; threshold: string }, services = defaultServices) => {
  return services.dayjs(date).isBefore(services.dayjs(threshold));
};

export const isDateSameOrBefore = ({ fromDate, toDate }: { fromDate: string; toDate: string }, services = defaultServices) => {
  return services.dayjs(fromDate).isSameOrBefore(services.dayjs(toDate));
};

export const isDateSameOrAfter = ({ fromDate, toDate }: { fromDate: string; toDate: string }, services = defaultServices) => {
  return services.dayjs(fromDate).isSameOrAfter(services.dayjs(toDate));
};

export const isDateSame = ({ fromDate, toDate }: { fromDate: string; toDate: string }, services = defaultServices) => {
  return services.dayjs(fromDate).isSame(services.dayjs(toDate));
};

export const isDateAfter = ({ fromDate, toDate }: { fromDate: string; toDate: string }, services = defaultServices) => {
  return services.dayjs(fromDate).isAfter(services.dayjs(toDate));
};

export const getFormattedDate = (date: string, format = "DD/MM/YYYY", services = defaultServices) => {
  if (!date) {
    return "";
  }
  const validDate = services.dayjs(date, determineDateFormat(date), true).format("YYYY-MM-DDTHH:mm:ss");
  if (isDateAfter({ fromDate: validDate, toDate: "1900-01-01" })) {
    return services.dayjs(validDate).format(format);
  }
  return "";
};

export const subtractYears = ({ fromDate, years, format = "YYYY-MM-DD" }: { fromDate: string; years: number; format?: string }) => {
  return dayjs(fromDate).subtract(years, "years").format(format);
};

export const datePickerStrings = {
  months: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
  shortMonths: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"],
  days: ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"],
  shortDays: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
  goToToday: "Vai ad oggi",
  prevMonthAriaLabel: "Vai al mese precedente",
  nextMonthAriaLabel: "Vai al mese successivo",
  prevYearAriaLabel: "Vai all'anno precedente",
  nextYearAriaLabel: "Vai all'anno successivo",
  closeButtonAriaLabel: "Chiudi scelta data",
  isRequiredErrorMessage: "La data è obbligatoria.",
  invalidInputErrorMessage: "Formato data non valido.",
  isOutOfBoundsErrorMessage: "La data deve essere tra ",
};

export const limitTime = (val = "", max = "0") => {
  let result = val;
  if (val.length === 1 && Number(val) > Number(max[0])) {
    result = `0${result}`;
  }
  if (val.length === 2) {
    if (Number(val) === 0) {
      result = "00";
    } else if (val > max) {
      result = max;
    }
  }
  return result;
};

export const limit = (value: string, max = "0") => {
  switch (value.length) {
    case 1:
      return value[0] > max[0] ? `0${value}` : value;
    case 2:
      if (Number(value) === 0) {
        return "01";
      }
      if (value > max) {
        return max;
      }
      break;
    default:
      return value;
  }
  return value;
};

export const limitYear = (value: string, max = "0") => {
  switch (value.length) {
    case 1:
      return value[0] > max[0] ? `0${value}` : value;
    case 2:
      if (Number(value) === 0) {
        return "00";
      }
      if (value > max) {
        return max;
      }
      break;
    default:
      return value;
  }
  return value;
};

export const autoCompleteTimeField = (val: string) => {
  const { length } = val;
  switch (length) {
    case 0:
      return "00:00";
    case 1:
      return `${val}0:000`;
    case 2:
      return `${val}:00`;
    case 3:
      return `${val}00`;
    case 4:
      return `${val}0`;
    default:
      return val;
  }
};

export const autoCompleteField = (value: string, withTime: boolean = false, services = defaultServices) => {
  const dateTimeParts = (value.toString() || "").split(" ");
  const dateParts = dateTimeParts[0].split("/");
  const currentYear = services.dayjs().year();

  if (dateParts.length === 3) {
    const [day, month, year] = dateParts;
    if (Number(day) < 1 || Number(day) > 31 || Number(month) < 1 || Number(month) > 12) {
      throw new Error("Invalid format date");
    }
    switch (year.length) {
      case 1:
      case 2: {
        const stringYear = `${currentYear.toString().slice(0, -year.length)}${year}`;
        const date = new Date(Number(stringYear), Number(month) - 1, Number(day));
        return services.dayjs(date).format("YYYY-MM-DD");
      }
      default: {
        const fixedYear = year.length === 3 ? `${year}0` : year;
        const minYear = Math.max(Number(fixedYear), 1900);
        const maxOrMinYear = Math.min(minYear, 2099);
        if (withTime && dateTimeParts[1]) {
          const timeParts = autoCompleteTimeField(dateTimeParts[1]).split(":");
          const hour = (timeParts[0] || "").length ? limitTime(timeParts[0], "23") : 0;
          const minutes = (timeParts[1] || "").length ? limitTime(timeParts[1], "59") : 0;
          return services.dayjs(new Date(maxOrMinYear, Number(month) - 1, Number(day), Number(hour), Number(minutes))).format("YYYY-MM-DD HH:mm");
        }
        return services.dayjs(new Date(maxOrMinYear, Number(month) - 1, Number(day))).format(withTime ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
      }
    }
  }

  if (dateParts.length === 2) {
    const [day, month] = dateParts;
    const date = new Date(Number(services.dayjs().format("YYYY")), Number(month) - 1, Number(day));
    return services.dayjs(date).format("YYYY-MM-DD");
  }

  if (dateParts.length === 1 && dateParts[0]) {
    const [day] = dateParts;
    const date = new Date(Number(dayjs().format("YYYY")), Number(services.dayjs().format("MM")) - 1, Number(day));
    return services.dayjs(date).format("YYYY-MM-DD");
  }
  return null;
};

export const getWeekOfYearFromDate = (date: string, services = defaultServices) => {
  const formattedDate = getFormattedDate(date, "YYYY-MM-DD");
  return formattedDate ? services.dayjs(formattedDate).isoWeek() : 0;
};

export const getMonthName = (monthNumber: number) => {
  if (typeof monthNumber !== "number" || monthNumber < 1 || monthNumber > 12) {
    return undefined;
  }
  const date = new Date();
  date.setMonth(monthNumber - 1);
  return date.toLocaleString("it-IT", { month: "short" });
};

export const getDayName = (date = new Date(), locale = "it-IT") => date.toLocaleDateString(locale, { weekday: "short" });

export const getWeekdayName = (
  dateInput: string | Date = new Date(),
  locale = "it-IT",
  short = false,
  services = defaultServices
): string => {
  try {
    let day: Date;
    if (typeof dateInput === "string") {
      if (!isValidDate(dateInput)) {
        return "";
      }
      const fmt = determineDateFormat(dateInput);
      day = fmt ? services.dayjs(dateInput, fmt).toDate() : services.dayjs(dateInput).toDate();
    } else {
      day = dateInput;
    }
    return day.toLocaleDateString(locale, { weekday: short ? "short" : "long" });
  } catch {
    return "";
  }
};

export const getAddedDate = ({ fromDate = "", period = 6, format = "YYYY-MM-DD" }, services = defaultServices) => {
  if (!fromDate || !isValidDate(fromDate)) {
    throw new Error("`fromDate` must be required or date is not valid");
  }
  if (period === 0) {
    return services.dayjs(fromDate).add(1, "year").format(format);
  }
  if (period === 1) {
    return services.dayjs(fromDate).add(6, "months").format(format);
  }
  if (period === 2) {
    return services.dayjs(fromDate).add(1, "quarters").format(format);
  }
  if (period === 3) {
    return services.dayjs(fromDate).add(2, "months").format(format);
  }
  if (period === 4) {
    return services.dayjs(fromDate).add(1, "months").format(format);
  }
  if (period === 5) {
    return services.dayjs(fromDate).add(1, "weeks").format(format);
  }
  if (period === 6) {
    return services.dayjs(fromDate).add(1, "days").format(format);
  }
  throw new Error("Unknown period");
};

export const getDatesInRange = (
  {
    fromDate,
    toDate,
    period,
    dates = [],
  }: {
    fromDate: string;
    toDate: string;
    period: number;
    dates?: string[];
  },
  services = defaultServices
): string[] => {
  if (!isValidDate(fromDate)) {
    throw new Error("`fromDate` must be required or date is not valid");
  }
  const nextDate: string = getAddedDate({
    fromDate: dates[dates.length - 1] || fromDate,
    period,
  });
  const endDate: string = isValidDate(toDate) ? toDate : services.dayjs().add(2, "year").format();

  if (isDateAfter({ fromDate: nextDate, toDate: endDate }, services)) {
    return dates;
  }
  return getDatesInRange(
    {
      fromDate,
      toDate: endDate,
      period,
      dates: [...dates, nextDate],
    },
    services
  );
};

export const parseDateForGraphQL = (date: string): string | undefined => {
  if (!date) {
    return;
  }

  const format = determineDateFormat(date);

  if (!format) {
    return;
  }

  const parsed = dayjs(date, format, true);

  if (!parsed.isValid()) {
    return;
  }

  // normalizzazione a mezzanotte UTC
  const result = parsed.startOf("day").format("YYYY-MM-DDTHH:mm:ss");
  return result;
};
