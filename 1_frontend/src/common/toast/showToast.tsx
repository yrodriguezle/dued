import { ToastOptions, toast } from 'react-toastify';

interface ShowToastProps extends Omit<ToastOptions, 'type'> {
  type: string;
  message: JSX.Element | string,
}

const showToast = ({
  type = 'error',
  message,
  ...props
}: ShowToastProps) => {
  switch (type) {
  case 'error':
    toast.error(() => (
      <div style={{ paddingRight: 5 }}>
        <span>{message}</span>
      </div>
    ), {
      ...props,
    });
    break;
  case 'info':
    toast.info(() => (
      <div style={{ paddingRight: 5 }}>
        {message}
      </div>
    ), {
      ...props,
    });
    break;
  case 'warn':
    toast.warn(() => (
      <div style={{ paddingRight: 5 }}>
        {message}
      </div>
    ), {
      ...props,
    });
    break;
  case 'success':
    toast.success(() => (
      <div style={{ paddingRight: 5 }}>
        {message}
      </div>
    ), {
      ...props,
    });
    break;
  default:
    toast(message, {
      ...props,
    });
    break;
  }
};

export default showToast;
