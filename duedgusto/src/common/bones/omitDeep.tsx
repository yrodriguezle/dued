/* eslint-disable @typescript-eslint/no-explicit-any */
function getType(obj: unknown): string {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

function omitDeep(value: any, omitArrayProperties: string[] = []): any {
  if (getType(value) === "array") {
    return value.map((item: any) => omitDeep(item, omitArrayProperties));
  }
  if (getType(value) === "object") {
    return Object.keys(value)
      .filter((key: string) => !omitArrayProperties.includes(key))
      .reduce(
        (acc: any, key: string) => ({
          ...acc,
          [key]: omitDeep(value[key], omitArrayProperties),
        }),
        {}
      );
  }
  return value;
}

export default omitDeep;
