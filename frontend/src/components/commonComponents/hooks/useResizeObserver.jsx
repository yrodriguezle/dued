import {
  useRef, useLayoutEffect, useState, useCallback,
} from 'react';

const useResizeObserver = () => {
  const [entry, setEntry] = useState({});
  const [node, setNode] = useState(null);
  const observer = useRef(null);

  const disconnect = useCallback(() => {
    if (observer.current) {
      observer.current.disconnect();
    }
  }, []);

  const observe = useCallback(() => {
    observer.current = new ResizeObserver(([newEntry]) => setEntry(newEntry));
    if (node && observer && observer.current) {
      observer.current.observe(node);
    }
  }, [node]);

  useLayoutEffect(() => {
    observe();
    return () => disconnect();
  }, [disconnect, observe]);

  return [setNode, entry, node];
};

export default useResizeObserver;
