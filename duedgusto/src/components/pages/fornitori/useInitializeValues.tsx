import { useCallback, useEffect, useRef, useState } from "react";
import { FormikFornitoreValues } from "./FornitoreDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
}

function useInitializeValues({ skipInitialize }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikFornitoreValues = {
      fornitoreId: undefined,
      ragioneSociale: "",
      ragioneSociale2: "",
      partitaIva: "",
      codiceFiscale: "",
      email: "",
      telefono: "",
      indirizzo: "",
      citta: "",
      cap: "",
      provincia: "",
      paese: "IT",
      note: "",
      attivo: true,
      aliquotaIva: 22,
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikFornitoreValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(async (values?: Partial<FormikFornitoreValues>) => {
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
