import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';
import flatMap from 'lodash/flatMap';

export const sleep = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

export const getBooleanFromString = (boolean) => boolean === 'true';

export const getNullableBooleanFromString = (string) => {
  if (string === '') {
    return null;
  }
  return (
    string === 'True'
  );
};

const permissionByte = {
  1: 'readDenied',
  2: 'insertDenied',
  4: 'updateDenied',
  8: 'deleteDenied',
  16: 'exportDenied',
  32: 'sendMailDenied',
  64: 'printDenied',
  128: 'hideMenuItem',
};

export const isPermitted = (permissions = [], securityContextId = 0, permissionBit = 0) => {
  const hasPermission = permissions.find(({ securityID }) => securityID === securityContextId);
  return (
    hasPermission ? !hasPermission[permissionByte[permissionBit]] : true
  );
};

export const getImagePreview = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    resolve(event.target.result);
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const replaceNullsWithUndefined = (object) => Object.keys(object)
  .map((key) => ({ key, value: object[key] }))
  .map(({ key, value }) => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? { key, value: replaceNullsWithUndefined(value) }
      : { key, value: value === null ? undefined : value }
  ))
  .reduce(
    (accumulator, { key, value }) => ({ ...accumulator, [key]: value }),
    {},
  );

export const removeEmptyPropertyFromObject = (object = {}) => Object.keys(object)
  .map((key) => ({ key, value: object[key] }))
  .map(({ key, value }) => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? { key, value: replaceNullsWithUndefined(value) }
      : { key, value: value === null ? undefined : value }
  ))
  .filter(({ key, value }) => value !== undefined && key !== '__typename' && key !== 'key' && key !== 'keys')
  .reduce(
    (accumulator, { key, value }) => ({ ...accumulator, [key]: value }),
    {},
  );

export const replaceLinkTagWithBlankAttribute = (message) => {
  const linkTag = /<a([^>]+)>/gim;
  const targetAttribute = /target="(\w+)"/gim;
  const matches = [...message.matchAll(linkTag)];
  return matches.reduce(
    (accumulator, [match]) => (targetAttribute.test(match)
      ? accumulator.replace(match, match.replace(targetAttribute, 'target="_bank"'))
      : accumulator.replace(match, `${match.slice(0, -1)} target="_bank">`)),
    message,
  );
};

export const getUrlParams = (url) => (url.match(/([^?=&]+)(=([^&]*))?/g) || [])
  .reduce((accumulator, each) => {
    const [key, value] = each.split('=');
    if (key.endsWith('[]')) {
      const [newKey] = key.split('[]');
      return {
        ...accumulator,
        [newKey]: [...(accumulator[newKey] || []), value],
      };
    }
    return {
      ...accumulator,
      [key]: value,
    };
  }, {});

export const sanitizeDBString = (string = '') => string.replace(/'/g, "''");

export const toArrayBuffer = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

export const toTextFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

export const setSelectedCAPLocalitaSigProv = (item, name, setFieldValue) => {
  if (item) {
    const { cAP, localita, sigProv } = item;
    setFieldValue('cAP', cAP);
    setFieldValue('localita', localita);
    setFieldValue('sigProv', sigProv);
  }
};

export const setSelectedLocalitaSigProvNascita = (item, name, setFieldValue) => {
  if (item) {
    const { localita, sigProv } = item;
    setFieldValue('localitaNascita', localita);
    setFieldValue('sigProvNascita', sigProv);
  }
};

export const setSelectedLocalitaSigProvResidenza = (item, name, setFieldValue) => {
  if (item) {
    const { cAP, localita, sigProv } = item;
    setFieldValue('cAPResid', cAP);
    setFieldValue('localitaResid', localita);
    setFieldValue('sigProvResid', sigProv);
  }
};

export const setSelectedCodeOrDescription = (item, name, setFieldValue) => {
  const arrName = (name || '').split('.');
  const fieldName = arrName.pop();
  if (fieldName.startsWith('descriz')) {
    const { key } = item;
    const [, target] = fieldName.split('descriz');
    const codeName = [...arrName, `${target.charAt(0).toLowerCase()}${target.slice(1)}`].join('.');
    setFieldValue(codeName, key);
  } else if (item) {
    const { descriz } = item;
    const descriptionName = [...arrName, `descriz${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`].join('.');
    setFieldValue(descriptionName, descriz);
  }
};

export const setSelectedCodeOrDescriptionOnGrid = (value, params, item) => {
  const { column, node } = params;
  if (column.colId.startsWith('descriz') && item?.key) {
    const { key } = item;
    const [, target] = column.colId.split('descriz');
    node.setDataValue(`${target.charAt(0).toLowerCase()}${target.slice(1)}`, key);
  } else if (item) {
    const { descriz } = item;
    const descriptionName = `descriz${column.colId.charAt(0).toUpperCase()}${column.colId.slice(1)}`;
    const exists = params.columnApi.columnModel.columnDefs.some(({ colId }) => colId === descriptionName);
    if (exists) {
      node.setDataValue(descriptionName, descriz.trim());
    }
  }
};

export const selectGridCellOnBlur = ({
  fetchItems,
  params,
  value,
  queryName,
  queryField,
  queryId,
  colIdDescriz,
}) => value && fetchItems().then(({ data }) => {
  if (data && data[queryName]) {
    const { items } = data[queryName];
    const found = items.find((item) => item[queryId].toLowerCase() === value.toLowerCase());
    const newDescriz = (found && found[queryField]) || '';
    if (params.node.data[colIdDescriz] !== newDescriz) {
      const { rowIndex } = params;
      const [editingCell] = params.api.getEditingCells() || [];
      if (editingCell?.column?.colId === colIdDescriz && rowIndex === editingCell.rowIndex) {
        params.api.stopEditing();
        params.node.setDataValue(colIdDescriz, newDescriz);
        params.api.startEditingCell({ rowIndex: editingCell.rowIndex, colKey: colIdDescriz });
      } else {
        params.node.setDataValue(colIdDescriz, newDescriz);
      }
    }
  }
});

export const flattenKeys = (object) => {
  let results = [];
  Object.keys(object).forEach((key) => {
    if (typeof object[key] === 'object') {
      const temp = flattenKeys(object[key]);
      results = [...results, ...temp];
    } else {
      results = [...results, key];
    }
  });
  return results;
};

export const isInteger = (n = '') => {
  if (typeof n === 'string') {
    return Boolean(n.trim() && Number.isInteger(+n.trim()));
  }
  return Number.isInteger(+n);
};

export const isNumber = (n = '') => {
  if (typeof n === 'string') {
    return Boolean(n.trim() && !Number.isNaN(Number(n.replace(/\./g, '').replace(/,/, '.'))));
  }
  return typeof n === 'number';
};

export const getBarcodeFormat = (index) => [
  '',
  'ITF14',
  'CODE39',
  'CODE128',
  'EAN13',
  'EAN8',
  'UPC',
  'UPC',
][index];

export const getDefaultValueByType = (scalarType) => {
  switch (scalarType) {
    case 'Decimal':
    case 'Int':
    case 'Float':
    case 'Short':
    case 'Byte':
      return 0;
    case 'ID':
    case 'String':
      return '';
    case 'Boolean':
      return false;
    case 'DateTimeNull':
    case 'DateTime':
    case 'Date':
      return null;
    default:
      return undefined;
  }
};

export const getScrollbarWidth = () => {
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll'; // forcing scrollbar to appear
  outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
  document.body.appendChild(outer);
  const inner = document.createElement('div');
  outer.appendChild(inner);
  const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);
  outer.parentNode.removeChild(outer);
  return scrollbarWidth;
};

export const typeOf = (source) => typeof source;

export const shallowCompare = (source, target) => {
  if (typeOf(source) !== typeOf(target)) {
    return false;
  }
  if (typeOf(source) === 'object' && source !== null && Array.isArray(source)) {
    return source.length === target.length;
  }
  if (typeOf(source) === 'object' && source !== null && Object.keys(source).length) {
    const keys = Object.keys(source);
    return keys.length && keys.every((key) => shallowCompare(source[key], target[key]));
  }
  if (typeOf(source) === 'date') {
    return source.getTime() === target.getTime();
  }
  if (typeOf(source) === 'function') {
    return source.toString() === target.toString();
  }
  return source === target;
};

export const shouldUpdate = (prevProps, nextProps) => shallowCompare(prevProps, nextProps);

export const flattenBooleanValues = (object) => Object.values(object)
  .map((value) => (
    isPlainObject(value)
      ? flattenBooleanValues(value)
      : !isEmpty(value)
  ))
  .flat();
export const areObjectValuesEmpty = (object) => {
  const flattenValues = flattenBooleanValues(object);
  return flattenValues.length && flattenValues.every((value) => !value);
};

export const setOpacity = (hex, alpha) => `${hex}${Math.floor(alpha * 255).toString(16).padStart(2, 0)}`;

const letters = '0123456789ABCDEF'.split('');
export const randomColor = () => Array(6).fill().reduce((acc) => `${acc}${letters[Math.round(Math.random() * 15)]}`, '#');

export const randomColorWithOpacity = (opacity = 1) => setOpacity(randomColor(), opacity);

const words = [
  'Got',
  'ability',
  'shop',
  'recall',
  'fruit',
  'easy',
  'dirty',
  'giant',
  'shaking',
  'ground',
  'weather',
  'lesson',
  'almost',
  'square',
  'forward',
  'bend',
  'cold',
  'broken',
  'distant',
  'adjective.',
];
function randomNumber(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}
function getRandomWord(firstLetterToUppercase = false) {
  const word = words[randomNumber(0, words.length - 1)];
  return firstLetterToUppercase ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}
export const generateWords = (length = 10) => `${[...Array(length)].map((_, i) => getRandomWord(i === 0)).join(' ').trim()}.`;

export const getObjectValue = (obj, key) => key.split('.').reduce((acc, item) => acc[item], obj);

export const matchHtmlTag = (text = '') => text.match(/(<([^>]+)>)/gmi);

export const minimizeFirstLetterInArray = (array = []) => array.map((text = '') => `${text.charAt(0).toLowerCase()}${text.slice(1)}`);

const arrayValues = (array) => array
  .map((item) => {
    if (typeof item === 'object' && Array.isArray(item)) {
      return arrayValues(item);
    }
    if (typeof item === 'object') {
      return Object.keys(item).reduce((acc, key) => [...acc, item[key]], []);
    }
    return item;
  })
  .flat();
const flattenInto = (value) => ((typeof value === 'object' && Array.isArray(value)) ? arrayValues(value) : value);

export const findSearchboxRecordResult = (value = '', items = []) => items.find((item) => {
  const values = (flatMap(item, flattenInto) || [])
    .filter((required) => required)
    .map((val) => (typeof val === 'string' ? val.toLowerCase() : val));
  const typedValue = (value || '').toLowerCase();
  return values.includes(typedValue);
});

export const getOperatingSystemName = () => {
  const { userAgent } = window.navigator;
  const platform = window.navigator?.userAgentData?.platform || window.navigator.platform;
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  let os = null;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'Mac OS';
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'iOS';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (/Linux/.test(platform)) {
    os = 'Linux';
  }
  return os;
};
