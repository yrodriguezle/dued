import { useState, useCallback } from "react";
import { FormikMenuValues } from "./MenuDetails";

const useInitializeValues = ({ skipInitialize }: { skipInitialize: boolean }) => {
  const [initialValues, setInitialValues] = useState<FormikMenuValues>({
    menuId: 0,
    menuName: "",
    menuDescription: "",
  });

  const handleInitializeValues = useCallback(
    async (menu?: FormikMenuValues) => {
      if (menu) {
        setInitialValues(menu);
      } else if (!skipInitialize) {
        setInitialValues({
          menuId: 0,
          menuName: "",
          menuDescription: "",
        });
      }
    },
    [skipInitialize]
  );

  return { initialValues, handleInitializeValues };
};

export default useInitializeValues;
