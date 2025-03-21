function isEmpty<T>(value: T): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length === 0;
  }
  return false; // Per altri tipi di dati, considerali non vuoti
}

export default isEmpty;
