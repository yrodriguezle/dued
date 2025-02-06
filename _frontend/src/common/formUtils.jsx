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
