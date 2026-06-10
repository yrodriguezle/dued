import { useCallback, useEffect, useRef, useState } from "react";
import mergeWithDefaults from "../../../common/form/mergeWithDefaults";

interface UseCrudFormOptions<T extends object> {
  /** Valori di default del form (factory per evitare condivisione di referenze) */
  defaultValues: () => T;
  /** Se true, salta l'inizializzazione automatica al mount (es. valori che arrivano dal padre) */
  skipInitialize?: boolean;
  /** Campo che riceve il focus iniziale (sostituisce i setInitialFocus.tsx per-modulo) */
  focusFieldName?: string;
}

interface UseCrudFormResult<T extends object> {
  initialValues: T;
  /** Merge parziale dei valori sui valori iniziali correnti; senza argomenti rimette il focus iniziale (comportamento identico ai useInitializeValues per-modulo) */
  handleInitializeValues: (values?: Partial<T>) => Promise<boolean>;
  /** Focus programmatico sul campo focusFieldName (per i reset post-conferma) */
  setInitialFocus: () => void;
}

/**
 * Hook generico per l'inizializzazione dei form CRUD: assorbe il pattern duplicato
 * per-modulo (default values, merge dei valori caricati, guard di inizializzazione
 * singola, focus iniziale). Lift del corpo di fornitori/useInitializeValues con
 * focus generalizzato via focusFieldName.
 */
function useCrudForm<T extends object>({ defaultValues, skipInitialize, focusFieldName }: UseCrudFormOptions<T>): UseCrudFormResult<T> {
  const initialized = useRef(false);

  const [initialValues, setInitialValues] = useState<T>(defaultValues);

  const setInitialFocus = useCallback(() => {
    if (!focusFieldName) return;
    const [element] = window.document.getElementsByName(focusFieldName);
    element?.focus();
  }, [focusFieldName]);

  const handleInitializeValues = useCallback(
    async (values?: Partial<T>) => {
      setInitialValues((prev) => mergeWithDefaults(values, prev));
      if (!values) {
        setInitialFocus();
      }

      return true;
    },
    [setInitialFocus]
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
    setInitialFocus,
  };
}

export default useCrudForm;
