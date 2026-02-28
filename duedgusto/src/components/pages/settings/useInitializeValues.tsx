import { useCallback, useEffect, useRef, useState } from "react";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
}

function useInitializeValues({ skipInitialize }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: BusinessSettings = {
      businessName: "",
      openingTime: "",
      closingTime: "",
      operatingDays: [],
      timezone: "",
      currency: "",
      vatRate: 0,
      settingsId: 0,
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<BusinessSettings>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(async (values?: Partial<BusinessSettings>) => {
    setInitialValues((prev) => mergeWithDefaults(values, prev));
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
