import { Form, Formik, FormikProps } from "formik";
import { useCallback, useContext, useEffect, useRef } from "react";
import { z } from "zod";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import { formStatuses } from "../../../common/globals/constants";
import sleep from "../../../common/bones/sleep";
import setInitialFocus from "./setInitialFocus";
import { RoleNonNull } from "../../common/form/searchbox/searchboxOptions/roleSearchboxOptions";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import RoleForm from "./RoleForm";
import { Box, Paper, Typography } from "@mui/material";
import useSubmitRole from "../../../graphql/roles/useSubmitRole";
import showToast from "../../../common/toast/showToast";
import useGetAll from "../../../graphql/common/useGetAll";
import { menuFragment } from "../../../graphql/menus/fragments";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import RoleMenus from "./RoleMenus";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { GridReadyEvent } from "ag-grid-community";

const Schema = z.object({
  roleId: z.number(),
  roleName: z.string().nonempty("Nome role è obbligatorio"),
  roleDescription: z.string().optional(),
  menuIds: z.array(z.number()),
});

export type FormikRoleValues = z.infer<typeof Schema>;

function RoleDetails() {
  const gridRef = useRef<GridReadyEvent<MenuNonNull> | null>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const formRef = useRef<FormikProps<FormikRoleValues>>(null);
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const { submitRole } = useSubmitRole();
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione ruoli");
  }, [setTitle]);

  const { data } = useGetAll<MenuNonNull>({
    fragment: menuFragment,
    queryName: "menus",
    fragmentBody: "...MenuFragment",
    fetchPolicy: "network-only",
  });

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed = !hasChanges || await onConfirm({
        title: "Gestione role",
        content: "Sei sicuro di voler annullare le modifiche?",
        acceptLabel: "Si",
        cancelLabel: "No",
      });
      if (!confirmed) {
        return;
      }

      if (!gridRef.current?.api.isDestroyed() && (gridRef.current?.api.getDisplayedRowCount() ?? 0) > 0) {
        gridRef.current?.api.deselectAll();
      }
      await handleInitializeValues();
      formRef.current?.resetForm();
      await sleep(200);
      setInitialFocus();
    },
    [handleInitializeValues, onConfirm],
  );

  const handleGridReady = useCallback((event: GridReadyEvent<MenuNonNull>) => {
    gridRef.current = event;
  }, []);

  const handleSelectedItem = useCallback((item: RoleNonNull) => {
    handleInitializeValues(item).then(() => {
      setTimeout(() => {
        if (!gridRef.current?.api.isDestroyed() && (gridRef.current?.api.getDisplayedRowCount() ?? 0) > 0) {
          gridRef.current?.api.forEachNode((node) => {
            if (!node.data) return;
            if (item.menuIds.includes(node.data.menuId)) {
              node.setSelected(true);
            } else {
              node.setSelected(false);
            }
          });
        }
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: true,
        });
      }, 0);
    });
  }, [handleInitializeValues]);

  const onSubmit = async (values: FormikRoleValues) => {
    try {
      const menuIds = gridRef.current?.api.getSelectedNodes().map((node) => node.data?.menuId as number) || [];
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
      const role = await submitRole({
        role: {
          roleId: values.roleId,
          roleName: values.roleName,
          roleDescription: values.roleDescription ?? "",
        },
        menuIds,
      });
      if (!role) {
        throw new Error("Errore nella risposta del server");
      }
      handleSelectedItem(role);
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
      validate={(values: FormikRoleValues) => {
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
          />
          <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: 'auto', height: 'calc(100vh - 64px - 41px)' }}>
            <Typography id="view-title" variant="h5" gutterBottom>
              {title}
            </Typography>
            <Paper sx={{ padding: 1 }}>
              <RoleForm
                menus={data}
                onSelectItem={handleSelectedItem}
              />
            </Paper>
            <Paper sx={{ marginTop: 2, padding: 1 }}>
              <RoleMenus
                menus={data}
                onGridReady={handleGridReady}
              />
            </Paper>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default RoleDetails;
