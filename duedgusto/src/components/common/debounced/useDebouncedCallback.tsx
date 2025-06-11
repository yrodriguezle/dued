/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from "react";
import debounce from "../../../common/bones/debounce";

type CancelableDebouncedFunction<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => Promise<ReturnType<T>>) & {
  cancel: () => void;
};

function useDebouncedCallback<T extends (...args: any[]) => any>(cb: T, dependencies: React.DependencyList, delay = 0): CancelableDebouncedFunction<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callback = useMemo(() => debounce(cb, delay), dependencies) as CancelableDebouncedFunction<T>;

  useEffect(() => {
    return () => {
      callback.cancel?.();
    };
  }, [callback]);

  return callback;
}

export default useDebouncedCallback;
