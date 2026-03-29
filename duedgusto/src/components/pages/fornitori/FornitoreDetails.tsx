import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery } from "@apollo/client";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getFornitore } from "../../../graphql/fornitori/queries";
import { formStatuses } from "../../../common/globals/constants";
import { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import FornitoreFormContainer from "./FornitoreFormContainer";
import { FormikFornitoreValues, mapFornitoreToFormValues } from "./fornitoreFormSchema";

// Re-export per retrocompatibilità
export type { FormikFornitoreValues } from "./fornitoreFormSchema";

function FornitoreDetails() {
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadFornitore] = useLazyQuery(getFornitore);
  const [initialFornitoreValues, setInitialFornitoreValues] = useState<Partial<FormikFornitoreValues> | undefined>(undefined);
  const [initialFormStatus, setInitialFormStatus] = useState<{ formStatus: string; isFormLocked: boolean } | undefined>(undefined);
  const loadedRef = useRef(false);

  useEffect(() => {
    setTitle("Dettaglio Fornitore");
  }, [setTitle]);

  // Carica i dati del fornitore dall'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const fornitoreIdParam = searchParams.get("fornitoreId");

    if (fornitoreIdParam && !loadedRef.current) {
      loadedRef.current = true;
      const fornitoreId = parseInt(fornitoreIdParam, 10);
      if (!isNaN(fornitoreId)) {
        loadFornitore({ variables: { fornitoreId } }).then((result) => {
          if (result.data?.fornitori?.fornitore) {
            setInitialFornitoreValues(mapFornitoreToFormValues(result.data.fornitori.fornitore));
            setInitialFormStatus({
              formStatus: formStatuses.UPDATE,
              isFormLocked: true,
            });
          }
        });
      }
    }
  }, [location.search, loadFornitore]);

  const handleSelectedItem = useCallback(
    (item: FornitoreSearchbox) => {
      navigate(`/gestionale/fornitori-details?fornitoreId=${item.fornitoreId}`);
    },
    [navigate]
  );

  const handleFormReset = useCallback(
    async () => {
      // Il container gestisce il reset; per ricaricare dal server il page wrapper ricarica l'URL
      const searchParams = new URLSearchParams(location.search);
      const fornitoreIdParam = searchParams.get("fornitoreId");
      if (fornitoreIdParam) {
        const fornitoreId = parseInt(fornitoreIdParam, 10);
        const result = await loadFornitore({ variables: { fornitoreId } });
        if (result.data?.fornitori?.fornitore) {
          setInitialFornitoreValues(mapFornitoreToFormValues(result.data.fornitori.fornitore));
          setInitialFormStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: true,
          });
        }
      }
    },
    [location.search, loadFornitore]
  );

  return (
    <FornitoreFormContainer
      mode="page"
      title={title}
      onSelectItem={handleSelectedItem}
      onFormReset={handleFormReset}
      initialFornitoreValues={initialFornitoreValues}
      initialFormStatus={initialFormStatus}
    />
  );
}

export default FornitoreDetails;
