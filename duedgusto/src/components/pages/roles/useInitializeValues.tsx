import { useCallback, useEffect, useRef, useState } from "react";
import { FormikRuoloValues } from "./RoleDetails";
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
    const initialValues: FormikRuoloValues = {
      id: 0,
      nome: "",
      descrizione: "",
      menuIds: [],
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikRuoloValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: FormikRuoloValues) => {
      setInitialValues((prev) => mergeWithDefaults(values || getDefaultInitialValues(), prev));
      if (!values) {
        setInitialFocus();
      }

      return true;
    },
    [getDefaultInitialValues]
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
