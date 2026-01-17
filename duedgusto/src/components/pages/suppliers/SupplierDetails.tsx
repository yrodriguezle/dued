import { useCallback, useContext, useEffect, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import Paper from "@mui/material/Paper";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box } from "@mui/material";

import SupplierForm from "./SupplierForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getSupplier } from "../../../graphql/suppliers/queries";
import { mutationMutateSupplier } from "../../../graphql/suppliers/mutations";

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
  country: z.string().default("IT"),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

export type FormikSupplierValues = z.infer<typeof Schema>;

const initialValues: FormikSupplierValues = {
  supplierId: undefined,
  businessName: "",
  vatNumber: "",
  fiscalCode: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  country: "IT",
  notes: "",
  active: true,
};

function SupplierDetails() {
  const formRef = useRef<FormikProps<FormikSupplierValues>>(null);
  const { setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadSupplier] = useLazyQuery(getSupplier);
  const [mutateSupplier] = useMutation(mutationMutateSupplier);
  const onConfirm = useConfirm();

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
            const supplier = result.data.suppliers.supplier;
            const supplierValues: FormikSupplierValues = {
              supplierId: supplier.supplierId,
              businessName: supplier.businessName,
              vatNumber: supplier.vatNumber || "",
              fiscalCode: supplier.fiscalCode || "",
              email: supplier.email || "",
              phone: supplier.phone || "",
              address: supplier.address || "",
              city: supplier.city || "",
              postalCode: supplier.postalCode || "",
              country: supplier.country || "IT",
              notes: supplier.notes || "",
              active: supplier.active,
            };

            formRef.current?.setValues(supplierValues);
            formRef.current?.setStatus({
              formStatus: formStatuses.UPDATE,
              isFormLocked: true,
            });
          }
        });
      }
    }
  }, [location.search, loadSupplier]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed = !hasChanges || await onConfirm({
        title: "Gestione fornitori",
        content: "Sei sicuro di voler annullare le modifiche?",
        acceptLabel: "Si",
        cancelLabel: "No",
      });
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
            const supplier = result.data.suppliers.supplier;
            formRef.current?.setValues({
              supplierId: supplier.supplierId,
              businessName: supplier.businessName,
              vatNumber: supplier.vatNumber || "",
              fiscalCode: supplier.fiscalCode || "",
              email: supplier.email || "",
              phone: supplier.phone || "",
              address: supplier.address || "",
              city: supplier.city || "",
              postalCode: supplier.postalCode || "",
              country: supplier.country || "IT",
              notes: supplier.notes || "",
              active: supplier.active,
            });
          }
        }
      } else {
        formRef.current?.resetForm();
      }
    },
    [onConfirm, location.search, loadSupplier],
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
            formRef.current?.setStatus({
              formStatus: formStatuses.UPDATE,
              isFormLocked: true,
            });
          }
        }
      } catch {
        toast.error("Errore durante il salvataggio del fornitore", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    },
    [mutateSupplier, navigate],
  );

  const validate = useCallback((values: FormikSupplierValues) => {
    try {
      Schema.parse(values);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        return errors;
      }
      return {};
    }
  }, []);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Formik
        innerRef={formRef}
        initialValues={initialValues}
        validate={validate}
        onSubmit={handleSubmit}
        initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      >
        {({ isSubmitting }) => (
          <Form style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <FormikToolbar
              onFormReset={handleResetForm}
              disabledSave={isSubmitting}
            />

            <Paper sx={{ flex: 1, overflow: "auto", mt: 2, p: 3 }}>
              <SupplierForm />
            </Paper>
          </Form>
        )}
      </Formik>
    </Box>
  );
}

export default SupplierDetails;
