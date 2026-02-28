import { useCallback, useEffect, useRef, useState } from "react";
import { FormikCashRegisterValues } from "./RegistroCassaDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
  utenteId: number;
  currentDate: string;
}

function useInitializeValues({ skipInitialize, utenteId, currentDate }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikCashRegisterValues = {
      date: currentDate,
      utenteId,
      notes: "",
      status: "DRAFT",
      gridDirty: false,
    };
    return initialValues;
  }, [currentDate, utenteId]);

  const [initialValues, setInitialValues] = useState<FormikCashRegisterValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(async (values?: FormikCashRegisterValues) => {
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
