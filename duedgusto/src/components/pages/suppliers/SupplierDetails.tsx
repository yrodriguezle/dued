import { useCallback, useContext, useEffect, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import Paper from "@mui/material/Paper";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Typography } from "@mui/material";

import SupplierForm from "./SupplierForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getSupplier } from "../../../graphql/suppliers/queries";
import { mutationMutateSupplier } from "../../../graphql/suppliers/mutations";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";

const Schema = z.object({
  supplierId: z.number().optional(),
  businessName: z.string().nonempty("Ragione sociale è obbligatoria"),
  vatNumber: z.string().optional(),
  fiscalCode: z.string().optional(),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
  country: z.string().default("IT"),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

export type FormikSupplierValues = z.infer<typeof Schema>;

const mapSupplierToFormValues = (supplier: Supplier): Partial<FormikSupplierValues> => ({
  supplierId: supplier.supplierId,
  businessName: supplier.businessName,
  vatNumber: supplier.vatNumber || "",
  fiscalCode: supplier.fiscalCode || "",
  email: supplier.email || "",
  phone: supplier.phone || "",
  address: supplier.address || "",
  city: supplier.city || "",
  postalCode: supplier.postalCode || "",
  province: supplier.province || "",
  country: supplier.country || "IT",
  notes: supplier.notes || "",
  active: supplier.active,
});

function SupplierDetails() {
  const formRef = useRef<FormikProps<FormikSupplierValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadSupplier] = useLazyQuery(getSupplier);
  const [mutateSupplier] = useMutation(mutationMutateSupplier);
  const onConfirm = useConfirm();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });

  useEffect(() => {
    setTitle("Dettaglio Fornitore");
  }, [setTitle]);

  // Carica i dati del fornitore dall'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const supplierIdParam = searchParams.get("supplierId");

    if (supplierIdParam) {
      const supplierId = parseInt(supplierIdParam, 10);
      if (!isNaN(supplierId)) {
        loadSupplier({ variables: { supplierId } }).then((result) => {
          if (result.data?.suppliers?.supplier) {
            const supplierValues = mapSupplierToFormValues(result.data.suppliers.supplier);
            handleInitializeValues(supplierValues).then(() => {
              setTimeout(() => {
                formRef.current?.setStatus({
                  formStatus: formStatuses.UPDATE,
                  isFormLocked: true,
                });
              }, 0);
            });
          }
        });
      }
    }
  }, [location.search, loadSupplier, handleInitializeValues]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione fornitori",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) {
        return;
      }

      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        // Reload data from server
        const searchParams = new URLSearchParams(location.search);
        const supplierIdParam = searchParams.get("supplierId");
        if (supplierIdParam) {
          const supplierId = parseInt(supplierIdParam, 10);
          const result = await loadSupplier({ variables: { supplierId } });
          if (result.data?.suppliers?.supplier) {
            await handleInitializeValues(mapSupplierToFormValues(result.data.suppliers.supplier));
          }
        }
      } else {
        await handleInitializeValues();
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [onConfirm, location.search, loadSupplier, handleInitializeValues]
  );

  const handleSelectedItem = useCallback(
    (item: SupplierSearchbox) => {
      const supplierValues = mapSupplierToFormValues(item);
      handleInitializeValues(supplierValues).then(() => {
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

  const handleSubmit = useCallback(
    async (values: FormikSupplierValues) => {
      try {
        const result = await mutateSupplier({
          variables: {
            supplier: {
              supplierId: values.supplierId,
              businessName: values.businessName,
              vatNumber: values.vatNumber || undefined,
              fiscalCode: values.fiscalCode || undefined,
              email: values.email || undefined,
              phone: values.phone || undefined,
              address: values.address || undefined,
              city: values.city || undefined,
              postalCode: values.postalCode || undefined,
              province: values.province || undefined,
              country: values.country || "IT",
              notes: values.notes || undefined,
              active: values.active,
            },
          },
        });

        if (result.data?.suppliers?.mutateSupplier) {
          const supplier = result.data.suppliers.mutateSupplier;

          toast.success("Fornitore salvato con successo", {
            position: "bottom-right",
            autoClose: 2000,
          });

          // Se è un nuovo fornitore, naviga alla pagina di modifica
          if (!values.supplierId) {
            navigate(`/gestionale/suppliers-details?supplierId=${supplier.supplierId}`);
          } else {
            const updatedValues = mapSupplierToFormValues(supplier);
            await handleInitializeValues(updatedValues);
            setTimeout(() => {
              formRef.current?.setStatus({
                formStatus: formStatuses.UPDATE,
                isFormLocked: true,
              });
            }, 0);
          }
        }
      } catch {
        toast.error("Errore durante il salvataggio del fornitore", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    },
    [mutateSupplier, navigate, handleInitializeValues]
  );

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikSupplierValues) => {
        const result = Schema.safeParse(values);
        if (result.success) {
          return;
        }
        return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
      }}
      onSubmit={handleSubmit}
    >
      {() => (
        <Form noValidate>
          <FormikToolbar onFormReset={handleResetForm} />
          <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 41px)" }}>
            <Typography id="view-title" variant="h5" gutterBottom>
              {title}
            </Typography>
            <Paper sx={{ padding: 1 }}>
              <SupplierForm onSelectItem={handleSelectedItem} />
            </Paper>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default SupplierDetails;
