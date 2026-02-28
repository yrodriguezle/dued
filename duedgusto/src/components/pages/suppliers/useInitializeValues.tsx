import { useCallback, useEffect, useRef, useState } from "react";
import { FormikSupplierValues } from "./SupplierDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
}

function useInitializeValues({ skipInitialize }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikSupplierValues = {
      supplierId: undefined,
      businessName: "",
      vatNumber: "",
      fiscalCode: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
      province: "",
      country: "IT",
      notes: "",
      active: true,
    };
    return initialValues;
  }, []);

  const [initialValues, setInitialValues] = useState<FormikSupplierValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(async (values?: Partial<FormikSupplierValues>) => {
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
