import { Form, Formik, FormikProps } from "formik";
import { useCallback, useContext, useEffect, useRef } from "react";
import { z } from "zod";
import { GridReadyEvent } from "ag-grid-community";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import { DatagridStatus, formStatuses } from "../../../common/globals/constants";
import sleep from "../../../common/bones/sleep";
import setInitialFocus from "./setInitialFocus";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { Box, Typography } from "@mui/material";
import showToast from "../../../common/toast/showToast";
import MenuForm from "./MenuForm";
import { menuFragment } from "../../../graphql/menus/fragments";
import useGetAll from "../../../graphql/common/useGetAll";
import { MenuNonNull, MenuWithStatus } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import useStore from "../../../store/useStore";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useSubmitMenu from "../../../graphql/menus/useSubmitMenu";
import useDeleteMenus from "../../../graphql/menus/useDeleteMenus";
import omitDeep from "../../../common/bones/omitDeep";
import { MenuInput } from "../../../graphql/menus/mutations";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";

const Schema = z.object({
  gridDirty: z.boolean(),
});

export type FormikMenuValues = z.infer<typeof Schema>;

function MenuDetails() {
  const formRef = useRef<FormikProps<FormikMenuValues>>(null);
  const deletedRowIdsRef = useRef<number[]>([]);
  const gridApiRef = useRef<GridReadyEvent | null>(null);

  const { initialValues, handleInitializeValues } = useInitializeValues();
  const onInProgress = useStore((store) => store.onInProgress);
  const offInProgress = useStore((store) => store.offInProgress);

  const { title, setTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setTitle("Gestione voci di menù");
  }, [setTitle]);

  const { loading, data, refetch } = useGetAll<MenuNonNull>({
    fragment: menuFragment,
    queryName: "menus",
    fragmentBody: "...MenuFragment",
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (loading) {
      onInProgress("menuDetails");
    } else {
      offInProgress("menuDetails");
    }
  }, [loading, onInProgress, offInProgress]);

  const { submitMenus } = useSubmitMenu();
  const { deleteMenus } = useDeleteMenus();

  const onConfirm = useConfirm();

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione menu",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) {
        return;
      }
      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        await handleInitializeValues();
      } else {
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [handleInitializeValues, onConfirm]
  );

  const onSubmit = async () => {
    try {
      onInProgress("menuDetailsSave");

      // Raccogliere i dati della griglia
      const gridData: DatagridData<MenuWithStatus>[] = [];
      if (gridApiRef.current) {
        gridApiRef.current.api.forEachNode((node) => {
          if (node.data) {
            gridData.push(node.data);
          }
        });
      }

      // Filtrare le righe modificate/aggiunte
      const modifiedOrAdded = gridData.filter(
        (row) => row.status === DatagridStatus.Modified || row.status === DatagridStatus.Added
      );

      // Mappare a MenuInput rimuovendo __typename e status
      const menusToSubmit: MenuInput[] = modifiedOrAdded.map((row) => {
        const cleaned = omitDeep(row, ["__typename", "status"]);
        return cleaned as MenuInput;
      });

      // Leggere gli ID cancellati
      const idsToDelete = [...deletedRowIdsRef.current];

      // Se non ci sono modifiche, non fare nulla
      if (menusToSubmit.length === 0 && idsToDelete.length === 0) {
        return;
      }

      // Eseguire prima le delete, poi le upsert
      if (idsToDelete.length > 0) {
        await deleteMenus(idsToDelete);
      }

      if (menusToSubmit.length > 0) {
        await submitMenus({ menus: menusToSubmit });
      }

      // Refetch dei dati aggiornati
      refetch();

      // Reset stato
      deletedRowIdsRef.current = [];
      formRef.current?.setFieldValue("gridDirty", false);

      showToast({
        type: "success",
        position: "bottom-right",
        message: "Operazione completata con successo",
        autoClose: 2000,
        toastId: "success",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      showToast({
        type: "error",
        position: "bottom-right",
        message: error?.message || "Errore nella risposta del server",
        toastId: "error",
      });
    } finally {
      offInProgress("menuDetailsSave");
    }
  };

  return (
    <Box>
      <Formik
        innerRef={formRef}
        enableReinitialize
        initialValues={initialValues}
        initialStatus={{ formStatus: formStatuses.UPDATE, isFormLocked: true }}
        validate={(values: FormikMenuValues) => {
          const result = Schema.safeParse(values);
          if (result.success) {
            return;
          }
          return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
        }}
        onSubmit={onSubmit}
      >
        {() => (
          <Form noValidate>
            <FormikToolbar
              onFormReset={handleResetForm}
              hideNewButton
              hideDeleteButton
            />
            <Box sx={{ marginTop: 1, paddingX: 2 }}>
              <Typography
                variant="h5"
                gutterBottom
              >
                {title}
              </Typography>
            </Box>
            {!loading && (
              <Box sx={{ marginTop: 1, paddingX: 1 }}>
                <MenuForm
                  menus={data || []}
                  deletedRowIdsRef={deletedRowIdsRef}
                  gridApiRef={gridApiRef}
                />
              </Box>
            )}
          </Form>
        )}
      </Formik>
    </Box>
  );
}

export default MenuDetails;
