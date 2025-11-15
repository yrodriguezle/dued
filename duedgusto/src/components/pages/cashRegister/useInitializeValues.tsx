import { useCallback, useEffect, useRef, useState } from "react";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";
import dayjs from "dayjs";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
  userId: number;
}

function useInitializeValues({ skipInitialize, userId }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikCashRegisterValues = {
      date: dayjs().format("YYYY-MM-DD"),
      userId,
      openingCounts: [],
      closingCounts: [],
      supplierExpenses: 0,
      dailyExpenses: 0,
      notes: "",
      status: "DRAFT",
    };
    return initialValues;
  }, [userId]);

  const [initialValues, setInitialValues] = useState<FormikCashRegisterValues>(getDefaultInitialValues());

  const handleInitializeValues = useCallback(
    async (values?: FormikCashRegisterValues) => {
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
