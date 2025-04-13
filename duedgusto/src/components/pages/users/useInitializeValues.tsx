import { useCallback, useEffect, useRef, useState } from "react";
import { FormikUserValues } from "./UserDetails";
import setInitialFocus from "./setInitialFocus";

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
  const [initialValues, setInitialValues] = useState(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: FormikUserValues) => {
      setInitialValues((typeof values === 'object' && values !== null) ? values : getDefaultInitialValues());
      if (!values) {
        setInitialFocus();
      }
      return true;
    },
    [getDefaultInitialValues],
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

export default useInitializeValues