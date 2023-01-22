const isEmpty = (value) => {
  if (value === null || value === undefined) {
    return true;
  }
  if (value.prop && value.prop.constructor === Array) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0 && value.constructor === Object;
  }
  if (typeof value === 'string') {
    return value.length === 0;
  }
  if (typeof value === 'number') {
    return value === 0;
  } if (!value) {
    return true;
  }
  return false;
};

export default isEmpty;
