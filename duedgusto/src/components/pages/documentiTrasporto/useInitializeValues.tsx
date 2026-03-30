import { useCallback, useEffect, useRef, useState } from "react";
import { FormikDocumentoTrasportoValues } from "./DocumentoTrasportoDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
}

function useInitializeValues({ skipInitialize }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikDocumentoTrasportoValues = {
      ddtId: undefined,
      fornitoreId: 0,
      nomeFornitore: "",
      invoiceId: undefined,
      invoiceNumber: "",
      ddtNumber: "",
      ddtDate: "",
      amount: 0,
      notes: "",
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikDocumentoTrasportoValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(async (values?: Partial<FormikDocumentoTrasportoValues>) => {
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
