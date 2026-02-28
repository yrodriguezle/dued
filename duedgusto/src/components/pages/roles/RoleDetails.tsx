import { Form, Formik, FormikProps } from "formik";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { z } from "zod";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import { formStatuses } from "../../../common/globals/constants";
import sleep from "../../../common/bones/sleep";
import setInitialFocus from "./setInitialFocus";
import { RuoloNonNull } from "../../common/form/searchbox/searchboxOptions/ruoloSearchboxOptions";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import RoleForm from "./RoleForm";
import { Box, Typography } from "@mui/material";
import useSubmitRuolo from "../../../graphql/ruolo/useSubmitRole";
import showToast from "../../../common/toast/showToast";
import useGetAll from "../../../graphql/common/useGetAll";
import { menuFragment } from "../../../graphql/menus/fragments";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import RoleMenus from "./RoleMenus";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { GridReadyEvent } from "ag-grid-community";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";

const Schema = z.object({
  id: z.number(),
  nome: z.string().nonempty("Nome ruolo è obbligatorio"),
  descrizione: z.string().optional(),
  menuIds: z.array(z.number()),
});

export type FormikRuoloValues = z.infer<typeof Schema>;

import { useSearchParams } from "react-router";
import { ruoloFragment } from "../../../graphql/ruolo/fragments";

function RoleDetails() {
  const [selectedRuolo, setSelectedRuolo] = useState<RuoloNonNull | null>(null);
  const [searchParams] = useSearchParams();
  const ruoloIdParam = searchParams.get("ruoloId");
  const ruoloId = ruoloIdParam ? parseInt(ruoloIdParam, 10) : null;

  const gridRef = useRef<GridReadyEvent<DatagridData<MenuNonNull>> | null>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const formRef = useRef<FormikProps<FormikRuoloValues>>(null);
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const { submitRuolo } = useSubmitRuolo();
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione ruoli");
  }, [setTitle]);

  const { data: ruoli } = useGetAll<RuoloNonNull>({
    fragment: ruoloFragment,
    queryName: "ruoli",
    fragmentBody: "...RuoloFragment",
    fetchPolicy: "network-only",
    skip: !ruoloId,
  });

  const { data } = useGetAll<MenuNonNull>({
    fragment: menuFragment,
    queryName: "menus",
    fragmentBody: "...MenuFragment",
    fetchPolicy: "network-only",
  });

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione ruolo",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) {
        return;
      }

      if (!gridRef.current?.api.isDestroyed() && (gridRef.current?.api.getDisplayedRowCount() ?? 0) > 0) {
        gridRef.current?.api.deselectAll();
      }
      await handleInitializeValues();
      formRef.current?.resetForm();
      setSelectedRuolo(null);
      await sleep(200);
      setInitialFocus();
    },
    [handleInitializeValues, onConfirm]
  );

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<MenuNonNull>>) => {
    gridRef.current = event;
  }, []);

  const handleSelectedItem = useCallback(
    (item: RuoloNonNull) => {
      handleInitializeValues(item).then(() => {
        setSelectedRuolo(item);
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: true,
        });
      });
    },
    [handleInitializeValues]
  );

  useEffect(() => {
    if (ruoloId && ruoli.length > 0) {
      const ruolo = ruoli.find((r) => r.id === ruoloId);
      if (ruolo) {
        handleSelectedItem(ruolo);
      }
    }
  }, [ruoloId, ruoli, handleSelectedItem]);

  const onSubmit = async (values: FormikRuoloValues) => {
    try {
      const menuIds = gridRef.current?.api.getSelectedNodes().map((node) => node.data?.id as number) || [];
      if (menuIds.length === 0) {
        showToast({
          type: "warning",
          position: "bottom-right",
          message: "Selezionare almeno un menu",
          autoClose: 2000,
          toastId: "warning",
        });
        return;
      }
      const ruolo = await submitRuolo({
        ruolo: {
          id: values.id,
          nome: values.nome,
          descrizione: values.descrizione ?? "",
        },
        menuIds,
      });
      if (!ruolo) {
        throw new Error("Errore nella risposta del server");
      }
      handleSelectedItem(ruolo);
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
    }
  };

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikRuoloValues) => {
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
          <FormikToolbar onFormReset={handleResetForm} />
          <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 41px)" }}>
            <Typography id="view-title" variant="h5" gutterBottom>
              {title}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <RoleForm onSelectItem={handleSelectedItem} />
              <RoleMenus menus={data} onGridReady={handleGridReady} selectedIds={selectedRuolo?.menuIds} />
            </Box>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default RoleDetails;
