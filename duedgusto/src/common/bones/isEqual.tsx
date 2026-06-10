function getType(obj: unknown): string {
  return {}.toString.call(obj).slice(8, -1).toLowerCase();
}
function sortObject<T extends { [key: string]: unknown }>(obj: T): T {
  if (getType(obj) !== "object") {
    return obj;
  }

  const sorted: { [key: string]: unknown } = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = typeof obj[key] === "object" && obj[key] !== null ? sortObject(obj[key] as T) : obj[key];
    });

  return sorted as T;
}

const isEqual = (first: unknown, second: unknown): boolean => {
  if (first === second) {
    return true;
  }

  // Check for null or undefined values
  if (first === undefined || first === null || second === undefined || second === null) {
    return false;
  }

  // Check if the types are different
  if ((first as object).constructor !== (second as object).constructor) {
    return false;
  }

  // Check for arrays
  if (Array.isArray(first)) {
    const secondArray = second as unknown[];
    if (first.length !== secondArray.length) {
      return false;
    }
    return first.every((item, index) => isEqual(item, secondArray[index]));
  }

  // Object
  if (getType(first) === "object") {
    const sortedSource = sortObject(first as Record<string, unknown>);
    const sortedTarget = sortObject(second as Record<string, unknown>);
    const sourceKeys = Object.keys(sortedSource);
    const targetKeys = Object.keys(sortedTarget);
    if (sourceKeys.length !== targetKeys.length) {
      return false;
    }
    if (!sourceKeys.every((key, index) => isEqual(key, targetKeys[index]))) {
      return false;
    }
    return sourceKeys.every((key) => isEqual(sortedSource[key], sortedTarget[key]));
  }

  return false;
};

export default isEqual;
