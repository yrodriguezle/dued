/* eslint-disable @typescript-eslint/no-explicit-any */

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      const later = () => {
        timeoutId = undefined;
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
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
}

export default debounce;
