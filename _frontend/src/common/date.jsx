/* eslint-disable indent */
import moment from 'moment';

const defaultServices = {
  moment,
};

export const getFormatOfDate = (date = '') => {
  if (date.split('/').length === 3) {
    return 'it';
  }
  if (date.split('-').length === 3) {
    return 'en';
  }
  throw new Error('Unknow date format');
};

export const isValidDate = (date, format = ['YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD', 'DD/MM/YYYY']) => {
  if (!date) {
    return false;
  }
  return moment(date, format, true).isValid();
};

export const getFormattedDateTime = (date) => (
  (isValidDate(date) && date !== '1899-12-30')
    ? moment(date).format('DD/MM/YYYY HH:mm')
    : null);

export const isValidItalianDate = (date) => moment(date, 'DD/MM/YYYY', true).isValid();

export const formatDate = (date) => (
  (isValidDate(date)
    && !date.startsWith('1899-12-30')
    && !date.startsWith('1900-01-01')
    && !date.startsWith('0001-01-01'))
    ? moment(date, ['YYYY-MM-DD', 'DD/MM/YYYY']).format('YYYY-MM-DDT00:00:00')
    : null);

export const getCurrentDate = (format, services = defaultServices) => services.moment().format(format);

export const getDaysInMonth = (services = defaultServices) => services.moment().daysInMonth();

export const getStartOfCurrentQuarter = (format = 'YYYY-MM-DD', services = defaultServices) => services.moment().quarter(services.moment().quarter()).startOf('quarter').format(format);
export const getEndOfCurrentQuarter = (format = 'YYYY-MM-DD', services = defaultServices) => services.moment().quarter(services.moment().quarter()).endOf('quarter').format(format);

export const getStartOfPreviousQuarter = (format = 'YYYY-MM-DD', services = defaultServices) => services.moment().quarter(services.moment().subtract(1, 'Q').quarter()).startOf('quarter').format(format);
export const getEndOfPreviousQuarter = (format = 'YYYY-MM-DD', services = defaultServices) => services.moment().quarter(services.moment().subtract(1, 'Q').quarter()).endOf('quarter').format(format);

export const getStartOfPreviousMonth = (services = defaultServices) => services.moment().subtract(1, 'months').format('YYYY-MM-01');
export const getEndOfPreviousMonth = (services = defaultServices) => services.moment().subtract(1, 'months').format(`YYYY-MM-${services.moment().daysInMonth()}`);

export const getStartOfPreviousYear = (services = defaultServices) => services.moment().subtract(1, 'years').format('YYYY-01-01');
export const getEndOfPreviousYear = (services = defaultServices) => services.moment().subtract(1, 'years').format('YYYY-12-31');

export const formatItalianDate = (date) => moment(date, ['YYYY-MM-DD', 'DD/MM/YYYY']).format('DD/MM/YYYY');

export const getTimeFromDate = (date) => (isValidDate(date) ? moment(date).format('HH:mm') : '00:00');

export const addMilliseconds = (
  { date, milliseconds },
) => moment(date).add(milliseconds, 'milliseconds').format();

export const isDateBefore = (
  { date, threshold },
  services = defaultServices,
) => services.moment(date).isBefore(services.moment(threshold));

export const isDateSameOrBefore = (
  { fromDate, toDate },
  services = defaultServices,
) => services.moment(fromDate).isSameOrBefore(services.moment(toDate));

export const isDateSame = (
  { fromDate, toDate },
  services = defaultServices,
) => services.moment(fromDate).isSame(services.moment(toDate));

export const isDateAfter = (
  { fromDate, toDate },
  services = defaultServices,
) => services.moment(fromDate).isAfter(services.moment(toDate));

export const getFormattedDate = (date, format = 'DD/MM/YYYY') => (date && isDateAfter({ fromDate: date, toDate: '1900-01-01' }) ? moment(date).format(format) : '');

export const datePickerStrings = {
  months: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  shortMonths: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
  days: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
  shortDays: ['D', 'L', 'M', 'M', 'G', 'V', 'S'],
  goToToday: 'Vai ad oggi',
  prevMonthAriaLabel: 'Vai al mese precedente',
  nextMonthAriaLabel: 'Vai al mese successivo',
  prevYearAriaLabel: 'Vai all\'anno precedente',
  nextYearAriaLabel: 'Vai all\'anno successivo',
  closeButtonAriaLabel: 'Chiudi scelta data',
  isRequiredErrorMessage: 'La data è obbligatoria.',
  invalidInputErrorMessage: 'Formato data non valido.',
  isOutOfBoundsErrorMessage: 'La data deve essere tra ',
};

export const limitTime = (val = '', max = 0) => {
  let result = val;
  if (val.length === 1 && Number(val) > Number(max[0])) {
    result = `0${result}`;
  }
  if (val.length === 2) {
    if (Number(val) === 0) {
      result = '00';
    } else if (val > max) {
      result = max;
    }
  }
  return result;
};

export const limit = (value, max) => {
  switch (value.length) {
    case 1:
      return (value[0] > max[0] ? `0${value}` : value);
    case 2:
      if (Number(value) === 0) {
        return '01';
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

export const limitYear = (value, max) => {
  switch (value.length) {
    case 1:
      return (value[0] > max[0] ? `0${value}` : value);
    case 2:
      if (Number(value) === 0) {
        return '00';
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

export const dateFormat = (val, withTime) => {
  let date;
  const day = limit(val.substr(0, 2), '31');
  const month = limit(val.substr(2, 2), '12');
  const year = limitYear(val.substr(4, 4), '99');
  const hour = withTime && val.substr(8, 2) && limitTime(val.substr(8, 2), '23');
  const minutes = withTime && val.substr(10, 2) && limitTime(val.substr(10, 2), '59');

  if (day && month && year && hour && minutes) {
    if (minutes.length === 2) {
      const formattedDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minutes));
      return getFormattedDate(formattedDate, 'DD/MM/YYYY HH:mm');
    }
    const formattedDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour));
    const result = getFormattedDate(formattedDate, 'DD/MM/YYYY HH');
    return `${result}:${minutes}`;
  }

  if (day && month && year && hour) {
    if (hour.length === 2) {
      const formattedDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), 0);
      return getFormattedDate(formattedDate, 'DD/MM/YYYY HH');
    }
    const formattedDate = new Date(Number(year), Number(month) - 1, Number(day));
    const result = getFormattedDate(formattedDate, 'DD/MM/YYYY');
    return `${result} ${hour}`;
  }

  if (day && month && year) {
    switch (year.length) {
      case 4:
        {
          date = new Date(Number(year), Number(month) - 1, Number(day));
          return formatItalianDate(date);
        }
      default:
        return `${day}/${month}/${year}`;
    }
  }
  if (day && month && !year) {
    if (Number(month) === 0 || Number(month) === 1) {
      return `${day}/${month}`;
    }
    date = new Date(Number(moment().format('YYYY')), Number(month) - 1, Number(day));
    const result = formatItalianDate(date).split('/');
    return `${result[0]}/${result[1]}`;
  }
  return day;
};

export const autoCompleteField = (value, withTime) => {
  const dateTimeParts = (value || '').split(' ');
  const dateParts = dateTimeParts[0].split('/');
  if (dateParts.length === 3) {
    const [day, month, year] = dateParts;
    switch (year.length) {
      case 1:
        {
          const stringYear = `200${year}`;
          const date = new Date(Number(stringYear), Number(month) - 1, Number(day));
          return moment(date).format('YYYY-MM-DD');
        }
      case 2:
        {
          const stringYear = `20${year}`;
          const date = new Date(Number(stringYear), Number(month) - 1, Number(day));
          return moment(date).format('YYYY-MM-DD');
        }
      default:
        {
          const minYear = Number(year) < 1900 ? 1900 : Number(year);
          const maxOrMinYear = minYear > 2099 ? 2900 : minYear;
          if (withTime && dateTimeParts[1]) {
            const timeParts = dateTimeParts[1].split(':');
            const hour = (timeParts[0] || '').length ? limitTime(timeParts[0], '23') : 0;
            const minutes = (timeParts[1] || '').length ? limitTime(timeParts[1], '59') : 0;
            return moment(new Date(maxOrMinYear, Number(month) - 1, Number(day), Number(hour), Number(minutes))).format('YYYY-MM-DD HH:mm');
          }
          return moment(new Date(maxOrMinYear, Number(month) - 1, Number(day))).format('YYYY-MM-DD HH:mm');
        }
    }
  }
  if (dateParts.length === 2) {
    const [day, month] = dateParts;
    const date = new Date(Number(moment().format('YYYY')), Number(month) - 1, Number(day));
    return moment(date).format('YYYY-MM-DD');
  }
  if (dateParts.length === 1 && dateParts[0]) {
    const [day] = dateParts;
    const date = new Date(Number(moment().format('YYYY')), Number(moment().format('MM')) - 1, Number(day));
    return moment(date).format('YYYY-MM-DD');
  }
  return null;
};

export const getWeekOfYearFromDate = (date) => (getFormattedDate(date) ? moment(getFormattedDate(date, 'YYYY-MM-DD')).week() : 0);
