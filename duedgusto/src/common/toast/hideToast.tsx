import { toast } from "react-toastify";

function hideToast(id: string) {
  toast.dismiss(id);
}

export default hideToast;
