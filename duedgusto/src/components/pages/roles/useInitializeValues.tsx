import { useCallback, useEffect, useRef, useState } from "react";
import { FormikRoleValues } from "./RoleDetails";
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
    const initialValues: FormikRoleValues = {
      roleId: 0,
      roleName: "",
      roleDescription: "",
      menuIds: [],
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikRoleValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: FormikRoleValues) => {
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
