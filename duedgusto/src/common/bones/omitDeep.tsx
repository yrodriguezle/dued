function getType(obj: unknown): string {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return getType(value) === "object";
}

function omitDeep<T>(value: T, omitArrayProperties: string[] = []): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => omitDeep(item, omitArrayProperties)) as T;
  }
  if (isPlainRecord(value)) {
    return Object.keys(value)
      .filter((key: string) => !omitArrayProperties.includes(key))
      .reduce<Record<string, unknown>>(
        (acc, key: string) => ({
          ...acc,
          [key]: omitDeep(value[key], omitArrayProperties),
        }),
        {}
      ) as T;
  }
  return value;
}

export default omitDeep;
