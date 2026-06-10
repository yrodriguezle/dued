function debounce<TArgs extends unknown[], TReturn>(func: (...args: TArgs) => TReturn, wait: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = function (this: unknown, ...args: TArgs): Promise<Awaited<TReturn>> {
    return new Promise<Awaited<TReturn>>((resolve, reject) => {
      const later = () => {
        timeoutId = undefined;
        try {
          const result = func.apply(this, args);
          resolve(result as Awaited<TReturn> | PromiseLike<Awaited<TReturn>>);
        } catch (error) {
          reject(error);
        }
      };

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(later, wait);
    });
  };

  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debounced as ((...args: TArgs) => Promise<Awaited<TReturn>>) & { cancel: () => void };
}

export default debounce;
