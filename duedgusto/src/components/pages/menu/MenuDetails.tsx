import { Form, Formik, FormikProps } from "formik";
import { useCallback, useRef } from "react";
import { z } from "zod";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import { formStatuses } from "../../../common/globals/constants";
import sleep from "../../../common/bones/sleep";
import setInitialFocus from "./setInitialFocus";
import { MenuSearchbox } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import MenuForm from "./MenuForm";
import { Box, Paper, Typography } from "@mui/material";
import useSubmitMenu from "../../../graphql/menus/useSubmitMenu";
import showToast from "../../../common/toast/showToast";

const Schema = z.object({
  menuId: z.number(),
  menuName: z.string().nonempty("Nome menu è obbligatorio"),
  menuDescription: z.string().optional(),
});

export type FormikMenuValues = z.infer<typeof Schema>;

function MenuDetails() {
  const formRef = useRef<FormikProps<FormikMenuValues>>(null);
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const { submitMenu } = useSubmitMenu();

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

  const handleSelectedItem = useCallback(
    (item: MenuSearchbox) => {
      handleInitializeValues(item).then(() => {
        setTimeout(() => {
          formRef.current?.setStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: true,
          });
        }, 0);
      });
    },
    [handleInitializeValues]
  );

  const onSubmit = async (values: FormikMenuValues) => {
    try {
      const menu = await submitMenu({
        menu: {
          menuId: values.menuId,
          menuName: values.menuName,
          menuDescription: values.menuDescription ?? "",
        },
      });
      if (!menu) {
        throw new Error("Errore nella risposta del server");
      }
      handleSelectedItem(menu);
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
          <FormikToolbar onFormReset={handleResetForm} />
          <Box sx={{ marginTop: 1, paddingX: 2 }}>
            <Typography variant="h5" gutterBottom>
              Gestione menu
            </Typography>
            <Paper elevation={3} sx={{ padding: 1 }}>
              <MenuForm onSelectItem={handleSelectedItem} />
            </Paper>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default MenuDetails;
