import { useCallback, useEffect, useRef, useState } from "react";
import { FormikPurchaseInvoiceValues } from "./PurchaseInvoiceDetails";
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
    const initialValues: FormikPurchaseInvoiceValues = {
      invoiceId: undefined,
      supplierId: 0,
      supplierName: "",
      invoiceNumber: "",
      invoiceDate: "",
      dueDate: "",
      taxableAmount: 0,
      vatRate: 22,
      notes: "",
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikPurchaseInvoiceValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: Partial<FormikPurchaseInvoiceValues>) => {
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
