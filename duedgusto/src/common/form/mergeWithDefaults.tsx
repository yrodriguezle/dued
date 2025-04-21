/* eslint-disable @typescript-eslint/no-explicit-any */
function isObject(obj: any): obj is Record<string, any> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

export default function mergeWithDefaults<T extends object>(
  values: Partial<T> | undefined,
  defaults: T
): T {
  const merged: T = { ...defaults };

  Object.keys(defaults).forEach((key) => {
    const k = key as keyof T;
    const defVal = defaults[k];
    const val = values?.[k];

    if (val == null) {
      merged[k] = defVal;
    } else if (isObject(defVal) && isObject(val)) {
      merged[k] = mergeWithDefaults(val, defVal) as T[typeof k];
    } else {
      merged[k] = val as T[typeof k];
    }
  });

  return merged;
}
