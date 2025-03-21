import { useCallback } from "react";
import useStore from "../../../store/useStore";

function useProgress() {
  const { onInProgress, offInProgress } = useStore((store) => store);

  const setOnInProgress = useCallback(
    (label?: string) => onInProgress(label || "promiseLoading"),
    [onInProgress]
  );

  const setOffInProgress = useCallback(
    (label?: string) => offInProgress(label || "promiseLoading"),
    [offInProgress]
  );

  return { setOnInProgress, setOffInProgress };
}

export default useProgress;
