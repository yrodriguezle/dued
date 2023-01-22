import isArray from 'lodash/isArray';
import findIndex from 'lodash/findIndex';
import isEmpty from 'lodash/isEmpty';
import transform from 'lodash/transform';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import moment from 'moment';
import localization from 'moment/locale/it';

import { isDateSameOrBefore, isValidDate } from './date';
import logger from './logger';
import { sleep } from './utils';

export const getElementByNameOrId = (nameOrId) => {
  if (global.window.document.getElementsByName(nameOrId).length) {
    return global.window.document.getElementsByName(nameOrId)[0];
  } if (global.window.document.getElementById(`${nameOrId}-input`)) {
    return global.window.document.getElementById(`${nameOrId}-input`);
  } if (global.window.document.getElementById(nameOrId)) {
    return global.window.document.getElementById(nameOrId);
  }
  return null;
};

export const setFocus = (nameOrId) => {
  const element = getElementByNameOrId(nameOrId);
  if (element) {
    logger.log(element.focus);
    element.focus();
    return element;
  }
  return null;
};

const setObjectTouched = (object) => Object.keys(object)
  .map((key) => ({ key, value: object[key] }))
  .map(({ key, value }) => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? { key, value: setObjectTouched(value) }
      : { key, value: true }
  ))
  .reduce(
    (accumulator, { key, value }) => ({ ...accumulator, [key]: value }),
    {},
  );

export const getErrorFields = (object, prefix = '') => Object
  .keys(object)
  .map((key) => (typeof object[key] === 'object' ? getErrorFields(object[key], key) : (prefix && [prefix, key].join('.')) || key))
  .flat();

export const validateFormikForm = async (values, validateForm, setTouched, setMessage) => {
  setTouched(setObjectTouched(values));
  const errors = await validateForm();
  const [firstFieldError] = getErrorFields(errors);
  if (global.window.document.getElementsByName(firstFieldError)) {
    if (isArray(errors[firstFieldError])) {
      const indexError = findIndex(
        errors[firstFieldError],
        (item) => (typeof item === 'object'),
      );
      const errorArrayFieldKey = Object.keys(errors[firstFieldError][indexError])
        .find((key) => (errors[firstFieldError][indexError][key] ? key : undefined));
      setFocus(`${firstFieldError}.${indexError}.${errorArrayFieldKey}`);
    } else {
      setFocus(firstFieldError);
      if (setMessage && typeof setMessage === 'function' && errors[firstFieldError]) {
        setMessage({
          id: 'validator',
          message: errors[firstFieldError],
          type: 'error',
          action: 'add',
        });
      }
    }
  }
  if (isEmpty(errors)) {
    if (setMessage && typeof setMessage === 'function') {
      setMessage({
        id: 'validator',
        action: 'remove',
      });
    }
    return true;
  }
  logger.log(errors);
  return false;
};

export const difference = (object1, object2) => {
  function changes(object, base) {
    return transform(object, (result, value, key) => {
      if (!isEqual(value, base[key])) {
        // eslint-disable-next-line no-param-reassign
        result[key] = (isObject(value) && isObject(base[key])) ? changes(value, base[key]) : value;
      }
    });
  }
  return changes(object1, object2);
};

export function passwordsMatch(value) {
  return value === this.parent.password;
}

export function testAccessTime(value) {
  const { fromTime } = this.parent;
  const isSameOrBefore = isDateSameOrBefore({
    fromDate: moment(fromTime, 'HH:mm'),
    toDate: moment(value, 'HH:mm'),
  });
  return isSameOrBefore;
}

export function testExpiredDate(value) {
  moment.updateLocale('it', localization);
  return (value) ? isValidDate(value) : true;
}

export function validateCodSottogruppo(value, validateCodDesVar) {
  const { codGruppo } = this.parent;
  const codSottogruppo = `${codGruppo || ''}${value || ''}`;
  return (
    codSottogruppo
      ? validateCodDesVar(codSottogruppo, 'G')
      : true
  );
}

export async function validateGrid(gridRef) {
  gridRef.api.stopEditing();
  await sleep(200); // Questo è dovuto perchè la griglia non gestice le promise
  // e nel momento in qui prendiamo le righe, queste possono essere in processo di stopping
  const editingCells = gridRef.api.getEditingCells();
  if (editingCells.length) {
    // Se la griglia non ferma l'editing è perché ha lanciato la validazione di una cella
    return false;
  }
  const rowsToValidate = gridRef.context.getRowsToValidate()
    .filter(({ data }) => data.status);
  return rowsToValidate.reduce(
    (previousPromise, row) => previousPromise.then(async (accumulator) => {
      const result = await gridRef.context.handleValidateRow(row);
      return accumulator && result;
    }),
    Promise.resolve(true),
  );
}

export const validateOnBlur = (yupBag, validator, formRef) => {
  const { touched } = formRef.current;
  const path = yupBag?.path;
  return (
    (touched && touched[path])
      ? validator()
      : true
  );
};
