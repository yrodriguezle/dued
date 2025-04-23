import { useState, useCallback } from "react";
import { FormikMenuValues } from "./MenuDetails";

const useInitializeValues = () => {
  const [initialValues, setInitialValues] = useState<FormikMenuValues>({});

  const handleInitializeValues = useCallback(async () => {
    setInitialValues({});
  }, []);

  return { initialValues, handleInitializeValues };
};

export default useInitializeValues;
