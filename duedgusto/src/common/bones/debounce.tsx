/* eslint-disable @typescript-eslint/no-explicit-any */

function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      const later = () => {
        timeoutId = undefined;
        try {
          const result = func.apply(this, args);
          resolve(result);
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

  return debounced as typeof debounced & { cancel: () => void };
}

export default debounce;
