function last(array) {
  if (!Array.isArray(array)) {
    throw new Error('The argument must be an `array` type');
  }
  const copyArray = array.slice();
  return copyArray.pop();
}

export default last;
