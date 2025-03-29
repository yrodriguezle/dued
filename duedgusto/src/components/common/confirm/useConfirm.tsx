import { useCallback } from "react"
import useStore from "../../../store/useStore";

let trafficLightPromise = Promise.resolve(true);

type Confirm = Omit<ConfirmDialog, "open" | "onAccept">

function useConfirm() {
  const setConfirmValues = useStore((store) => store.setConfirmValues);
  return useCallback(
    ({ title, content, acceptLabel, cancelLabel }: Confirm) => {
      trafficLightPromise = trafficLightPromise.then(() => {
        return new Promise<boolean>((resolve) => {
          setConfirmValues({
            open: true,
            title,
            content,
            acceptLabel,
            cancelLabel,
            onAccept: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
      });
      return trafficLightPromise;
    },
    [setConfirmValues],
  )

}

export default useConfirm