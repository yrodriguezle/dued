import { useCallback, useLayoutEffect, useState } from "react";

interface Dimensions {
  width: number;
  height: number;
}

interface UseResizeObserverResult {
  ref: (node: HTMLElement | null) => void;
  dimensions: Dimensions;
}

function useResizeObserver(): UseResizeObserverResult {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });
  const [node, setNode] = useState<HTMLElement | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    setNode(node);
  }, []);

  useLayoutEffect(() => {
    if (!node) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      console.log("setDimensions", { width, height });
      setDimensions({ width, height });
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [node]);

  return { ref, dimensions };
}

export default useResizeObserver;
