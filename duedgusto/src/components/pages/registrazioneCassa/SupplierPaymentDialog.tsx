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
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import supplierSearchboxOption, { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import showToast from "../../../common/toast/showToast";
import { Formik, Form } from "formik";
import { Expense } from "./CashRegisterDetails";

interface SupplierPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (expense: Expense) => void;
}

interface PaymentFormValues {
  supplierName: string;
  supplierId: number;
  ddtNumber: string;
  amount: number;
  paymentMethod: string;
}

function SupplierPaymentDialog({ open, onClose, onConfirm }: SupplierPaymentDialogProps) {
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState<number>(0);
  const [ddtNumber, setDdtNumber] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("");

  const resetForm = useCallback(() => {
    setSupplierName("");
    setSupplierId(0);
    setDdtNumber("");
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

  const handleConfirm = useCallback(() => {
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

    const ddtLabel = ddtNumber ? ` - DDT ${ddtNumber}` : "";
    const description = `Pagamento ${supplierName}${ddtLabel}`;

    onConfirm({
      description,
      amount,
      isSupplierPayment: true,
      supplierId,
      ddtNumber,
      paymentMethod: paymentMethod || undefined,
    });
    resetForm();
    onClose();
  }, [supplierId, amount, ddtNumber, supplierName, paymentMethod, onConfirm, resetForm, onClose]);

  const initialValues: PaymentFormValues = {
    supplierName: "",
    supplierId: 0,
    ddtNumber: "",
    amount: 0,
    paymentMethod: "",
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { overflow: "visible" } }}>
      <Formik
        initialValues={initialValues}
        onSubmit={handleConfirm}
      >
        {() => (
          <Form noValidate>
            <DialogTitle>Pagamento Fornitore</DialogTitle>
            <DialogContent sx={{ overflow: "visible" }}>
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
                    <TextField
                      label="Numero DDT"
                      fullWidth
                      value={ddtNumber}
                      onChange={(e) => setDdtNumber(e.target.value)}
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
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>Annulla</Button>
              <Button type="submit" variant="contained" disabled={!supplierId || !amount}>
                Conferma
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}

export default SupplierPaymentDialog;
