import { useEffect, useMemo } from 'react';
import debounce from '../../../common/bones/debounce';

function useDebouncedCallback(cb, dependencies, delay = 0) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callback = useMemo(() => debounce(cb, delay), dependencies);

  useEffect(() => {
    const lastCallback = callback;

    return () => {
      if (lastCallback && lastCallback.cancel) {
        lastCallback.cancel();
      }
    };
  }, [callback]);

  return callback;
}

export default useDebouncedCallback;
