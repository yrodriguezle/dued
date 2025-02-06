function lowerFirst(value = '') {
  if (typeof value !== 'string') {
    throw new Error('The argument must be a `string` type');
  }
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

export default lowerFirst;
