import { Form, Formik, FormikProps } from "formik";
import { useCallback, useRef } from "react";
import { z } from "zod";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import { formStatuses } from "../../../common/globals/constants";
import sleep from "../../../common/bones/sleep";
import setInitialFocus from "./setInitialFocus";
import { RoleSearchbox } from "../../common/form/searchbox/searchboxOptions/roleSearchboxOptions";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import RoleForm from "./RoleForm";
import { Box, Paper, Typography } from "@mui/material";
import useSubmitRole from "../../../graphql/roles/useSubmitRole";
import showToast from "../../../common/toast/showToast";
// import useGetAll from "../../../graphql/common/useGetAll";
// import { menuFragment } from "../../../graphql/menus/fragments";
// import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";

const Schema = z.object({
  roleId: z.number(),
  roleName: z.string().nonempty("Nome role è obbligatorio"),
  roleDescription: z.string().optional(),
  menuIds: z.array(z.number()),
});

export type FormikRoleValues = z.infer<typeof Schema>;

function RoleDetails() {
  const formRef = useRef<FormikProps<FormikRoleValues>>(null);
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const { submitRole } = useSubmitRole();

  const onConfirm = useConfirm();

  // const {
  //   // loading: menusLoading,
  //   data: menus,
  // } = useGetAll<MenuNonNull>({
  //   fragmentBody: menuFragment,

  //   queryName: "menus",
  //   fetchPolicy: "network-only"
  // });

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
      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        await handleInitializeValues();
      } else {
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [handleInitializeValues, onConfirm],
  );

  const handleSelectedItem = useCallback((item: RoleSearchbox) => {
    handleInitializeValues(item).then(() => {
      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: true,
        });
      }, 0);
    });
  }, [handleInitializeValues]);

  const onSubmit = async (values: FormikRoleValues) => {
    try {
      const role = await submitRole({
        role: {
          roleId: values.roleId,
          roleName: values.roleName,
          roleDescription: values.roleDescription ?? "",
        },
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
          <Box sx={{ marginTop: 1, paddingX: 2 }}>
            <Typography variant="h5" gutterBottom>
              Gestione ruoli
            </Typography>
            <Paper elevation={3} sx={{ padding: 1 }}>
              <RoleForm
                menus={[]}
                onSelectItem={handleSelectedItem}
              />
            </Paper>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default RoleDetails;
