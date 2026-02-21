import { useCallback, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
} from "@mui/material";
import { useMutation } from "@apollo/client";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import supplierSearchboxOption, { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import purchaseInvoiceSearchboxOption, { PurchaseInvoiceSearchbox } from "../../common/form/searchbox/searchboxOptions/purchaseInvoiceSearchboxOptions";
import { mutationMutateSupplierPayment } from "../../../graphql/suppliers/mutations";
import showToast from "../../../common/toast/showToast";
import { Formik, Form } from "formik";

interface SupplierPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (expense: { description: string; amount: number }) => void;
}

interface PaymentFormValues {
  supplierName: string;
  supplierId: number;
  invoiceNumber: string;
  invoiceId: number | undefined;
  amount: number;
  paymentMethod: string;
}

function SupplierPaymentDialog({ open, onClose, onConfirm }: SupplierPaymentDialogProps) {
  const [mutatePayment] = useMutation(mutationMutateSupplierPayment);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceId, setInvoiceId] = useState<number | undefined>(undefined);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("");

  const resetForm = useCallback(() => {
    setSupplierName("");
    setSupplierId(0);
    setInvoiceNumber("");
    setInvoiceId(undefined);
    setAmount(0);
    setPaymentMethod("");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSelectSupplier = useCallback((item: SupplierSearchbox) => {
    setSupplierId(item.supplierId);
    setSupplierName(item.businessName);
  }, []);

  const handleSelectInvoice = useCallback((item: PurchaseInvoiceSearchbox) => {
    setInvoiceId(item.invoiceId);
    setInvoiceNumber(item.invoiceNumber);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!supplierId || !amount) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Fornitore e importo sono obbligatori",
        autoClose: 2000,
        toastId: "warning-payment",
      });
      return;
    }

    try {
      await mutatePayment({
        variables: {
          payment: {
            invoiceId: invoiceId || undefined,
            paymentDate: new Date().toISOString().split("T")[0],
            amount,
            paymentMethod: paymentMethod || undefined,
            notes: `Pagamento da chiusura cassa`,
          },
        },
      });

      const invoiceLabel = invoiceNumber ? ` - Fatt. ${invoiceNumber}` : "";
      const description = `Pagamento ${supplierName}${invoiceLabel}`;

      onConfirm({ description, amount });
      resetForm();
    } catch {
      showToast({
        type: "error",
        position: "bottom-right",
        message: "Errore durante la registrazione del pagamento",
        autoClose: 2000,
        toastId: "error-payment",
      });
    }
  }, [supplierId, amount, mutatePayment, invoiceId, paymentMethod, invoiceNumber, supplierName, onConfirm, resetForm]);

  const initialValues: PaymentFormValues = {
    supplierName: "",
    supplierId: 0,
    invoiceNumber: "",
    invoiceId: undefined,
    amount: 0,
    paymentMethod: "",
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { overflow: "visible" } }}>
      <DialogTitle>Pagamento Fornitore</DialogTitle>
      <DialogContent sx={{ overflow: "visible" }}>
        <Formik
          initialValues={initialValues}
          onSubmit={() => {}}
        >
          {() => (
            <Form>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormikSearchbox<PaymentFormValues, SupplierSearchbox>
                      label="Fornitore *"
                      placeholder="Seleziona fornitore"
                      name="supplierName"
                      required
                      fullWidth
                      fieldName="businessName"
                      options={supplierSearchboxOption}
                      onSelectItem={handleSelectSupplier}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormikSearchbox<PaymentFormValues, PurchaseInvoiceSearchbox>
                      label="Fattura"
                      placeholder="Cerca fattura"
                      name="invoiceNumber"
                      fullWidth
                      fieldName="invoiceNumber"
                      options={purchaseInvoiceSearchboxOption}
                      onSelectItem={handleSelectInvoice}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Importo *"
                      type="number"
                      fullWidth
                      value={amount || ""}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Metodo Pagamento"
                      fullWidth
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Form>
          )}
        </Formik>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Annulla</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!supplierId || !amount}>
          Conferma
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SupplierPaymentDialog;
