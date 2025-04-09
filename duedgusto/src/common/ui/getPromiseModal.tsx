/* eslint-disable @typescript-eslint/no-explicit-any */
type Callback<T> = React.Dispatch<React.SetStateAction<T>>;

interface BaseModalState<R = any> {
  show: boolean;
  onAccept: (response: R) => void;
  onCancel: (response: R) => void;
  onClose: (response: R) => void;
  // Altre proprietà opzionali
  [key: string]: any;
}

const getPromiseModal = <T extends BaseModalState<R>, R = any>(fn: Callback<T>, otherParams: Partial<T> = {}): Promise<R> =>
  new Promise((resolve) => {
    const handleClose = (response: R) => {
      fn((prevValues) => ({
        ...prevValues,
        show: false,
      }));
      resolve(response);
    };

    fn({
      show: true,
      onAccept: (response: R) => {
        fn((prevValues) => ({
          ...prevValues,
          show: false,
        }));
        resolve(response);
      },
      onCancel: (response: R) => {
        handleClose(response);
      },
      onClose: (response: R) => {
        handleClose(response);
      },
      ...otherParams,
    } as T);
  });

export default getPromiseModal;
