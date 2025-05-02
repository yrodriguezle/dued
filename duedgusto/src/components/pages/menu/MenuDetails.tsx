import { Form, Formik, FormikProps } from "formik";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { z } from "zod";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import { formStatuses } from "../../../common/globals/constants";
import sleep from "../../../common/bones/sleep";
import setInitialFocus from "./setInitialFocus";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { Box, Typography } from "@mui/material";
import showToast from "../../../common/toast/showToast";
import MenuForm from "./MenuForm";
import { menuFragment } from "../../../graphql/menus/fragments";
import useGetAll from "../../../graphql/common/useGetAll";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import useStore from "../../../store/useStore";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";

const Schema = z.object({});

export type FormikMenuValues = z.infer<typeof Schema>;

function MenuDetails() {
  const formRef = useRef<FormikProps<FormikMenuValues>>(null);
  const { initialValues, handleInitializeValues } = useInitializeValues();
  const { onInProgress, offInProgress } = useStore((store) => store);
  const [menus, setMenus] = useState<MenuNonNull[]>([]);

  const { title, setTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setTitle("Gestione voci di menu");
  }, [setTitle]);

  const { loading, data } = useGetAll<MenuNonNull>({
    fragment: menuFragment,
    queryName: "menus",
    fragmentBody: "...MenuFragment",
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (data.length) {
      setMenus(data.map((item) => ({ ...item })));
    }
  }, [data]);

  useEffect(() => {
    if (loading) {
      onInProgress("global");
    } else {
      offInProgress("global");
    }
  }, [loading, onInProgress, offInProgress]);

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
              <Typography variant="h5" gutterBottom>
                {title}
              </Typography>
            </Box>
            <Box sx={{ marginTop: 1, paddingX: 1 }}>
              <MenuForm menus={menus} />
            </Box>
          </Form>
        )}
      </Formik>
    </Box>
  );
}

export default MenuDetails;
