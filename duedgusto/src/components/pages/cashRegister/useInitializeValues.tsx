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
      incomes: [
        { type: "Pago in Bianco (Contante)", amount: 0 },
        { type: "Pagamenti Elettronici", amount: 0 },
        { type: "Pagamento con Fattura", amount: 0 },
      ],
      expenses: [],
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
