// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapFunc<T> = (item: T) => any;

function unionBy<T>(array1: T[], array2: T[], iteratee: MapFunc<T>): T[] {
  const uniqValues = new Set(array1.map(iteratee));
  const mergeArrays = array1.map((item1) => {
    const found = array2.find((item2) => iteratee(item1) === iteratee(item2)) || {} as T;
    return {
      ...found,
      ...item1,
    };
  });

  const result = Array.from(new Set([...mergeArrays, ...array2.filter((x) => !uniqValues.has(iteratee(x)))]));
  return result.toSorted((a, b) => {
    const valueA = iteratee(a);
    const valueB = iteratee(b);
    return valueA - valueB;
  });
}

export default unionBy;
