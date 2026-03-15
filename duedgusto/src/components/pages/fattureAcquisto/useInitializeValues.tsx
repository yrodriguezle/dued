import { useCallback, useEffect, useRef, useState } from "react";
import { FormikFatturaAcquistoValues } from "./FatturaAcquistoDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
}

function useInitializeValues({ skipInitialize }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikFatturaAcquistoValues = {
      invoiceId: undefined,
      fornitoreId: 0,
      nomeFornitore: "",
      invoiceNumber: "",
      invoiceDate: "",
      dueDate: "",
      taxableAmount: 0,
      vatRate: 22,
      notes: "",
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikFatturaAcquistoValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(async (values?: Partial<FormikFatturaAcquistoValues>) => {
    setInitialValues((prev) => mergeWithDefaults(values, prev));
    if (!values) {
      setInitialFocus();
    }

    return true;
  }, []);

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
