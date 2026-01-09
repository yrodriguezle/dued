import { useCallback, useEffect, useRef, useState } from "react";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import setInitialFocus from "./setInitialFocus";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseInitializeValuesProps {
  skipInitialize?: boolean;
  userId: number;
  currentDate: string;
}

function useInitializeValues({ skipInitialize, userId, currentDate }: UseInitializeValuesProps) {
  const initialized = useRef(false);

  const getDefaultInitialValues = useCallback(() => {
    const initialValues: FormikCashRegisterValues = {
      date: currentDate,
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
  }, [currentDate, userId]);

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
