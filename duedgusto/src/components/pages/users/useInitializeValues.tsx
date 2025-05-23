import { useCallback, useEffect, useRef, useState } from "react";
import { FormikUserValues } from "./UserDetails";
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
    const initialValues: FormikUserValues = {
      userId: 0,
      roleId: 0,
      userName: "",
      firstName: "",
      lastName: "",
      description: "",
      disabled: false,
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikUserValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: FormikUserValues) => {
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
