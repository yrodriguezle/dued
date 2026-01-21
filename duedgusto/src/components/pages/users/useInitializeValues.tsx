import { useCallback, useEffect, useRef, useState } from "react";
import { FormikUtenteValues } from "./UserDetails";
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
    const initialValues: FormikUtenteValues = {
      id: 0,
      ruoloId: 0,
      ruoloNome: "",
      nomeUtente: "",
      nome: "",
      cognome: "",
      descrizione: "",
      disabilitato: false,
      password: "",
      confirmPassword: "",
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikUtenteValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: Partial<FormikUtenteValues>) => {
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
