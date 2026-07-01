import { useCallback, useEffect, useRef, useState } from "react";
import { FormikRegistroCassaValues } from "./RegistroCassaDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";
import { statoRegistroCassa } from "../../../common/globals/constants";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
  utenteId: number;
  currentDate: string;
}

function useInitializeValues({ skipInitialize, utenteId, currentDate }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikRegistroCassaValues = {
      id: undefined,
      date: currentDate,
      utenteId,
      notes: "",
      status: statoRegistroCassa.DRAFT,
      gridDirty: false,
    };
    return initialValues;
  }, [currentDate, utenteId]);

  const [initialValues, setInitialValues] = useState<FormikRegistroCassaValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(async (values?: FormikRegistroCassaValues) => {
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
