import { useState, useCallback } from "react";
import { FormikMenuValues } from "./MenuDetails";

const useInitializeValues = () => {
  const [initialValues, setInitialValues] = useState<FormikMenuValues>({
    gridDirty: false,
  });

  const handleInitializeValues = useCallback(async () => {
    setInitialValues({
      gridDirty: false,
    });
  }, []);

  return { initialValues, handleInitializeValues };
};

export default useInitializeValues;
