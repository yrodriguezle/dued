import { useCallback, useEffect, useRef, useState } from "react";
import { FormikDeliveryNoteValues } from "./DeliveryNoteDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
}

function useInitializeValues({
  skipInitialize,
}: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikDeliveryNoteValues = {
      ddtId: undefined,
      supplierId: 0,
      supplierName: "",
      invoiceId: undefined,
      invoiceNumber: "",
      ddtNumber: "",
      ddtDate: "",
      amount: 0,
      notes: "",
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikDeliveryNoteValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: Partial<FormikDeliveryNoteValues>) => {
      setInitialValues((prev) => mergeWithDefaults(values, prev));
      if (!values) {
        setInitialFocus();
      }

      return true;
    },
    []
  );

  useEffect(() => {
    if (!skipInitialize && !initialized.current) {
      handleInitializeValues();
      initialized.current = true;
    }
  }, [handleInitializeValues, skipInitialize]);

  return {
    initialValues,
    handleInitializeValues,
  };
}

export default useInitializeValues;
