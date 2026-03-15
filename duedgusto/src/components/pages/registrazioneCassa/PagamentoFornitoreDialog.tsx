import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import fornitoreSearchboxOption, { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import showToast from "../../../common/toast/showToast";
import { Formik, Form } from "formik";

interface PagamentoFornitoreDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (expense: Expense) => void;
  /** Dati della spesa da modificare; se assente il dialog è in modalità aggiunta */
  initialData?: Expense;
}

interface PaymentFormValues {
  nomeFornitore: string;
  fornitoreId: number;
  ddtNumber: string;
  amount: number;
  paymentMethod: string;
}

function PagamentoFornitoreDialog({ open, onClose, onConfirm, initialData }: PagamentoFornitoreDialogProps) {
  const [nomeFornitore, setNomeFornitore] = useState("");
  const [fornitoreId, setFornitoreId] = useState<number>(0);
  const [documentType, setDocumentType] = useState<"FA" | "DDT">("DDT");
  const [ddtNumber, setDdtNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Contanti");

  // Pre-riempie tutti i campi quando il dialog si apre in modalità modifica
  useEffect(() => {
    if (initialData) {
      setNomeFornitore(initialData.description?.split(" - ")[0]?.replace("Pagamento ", "") ?? "");
      setFornitoreId(initialData.fornitoreId ?? 0);
      setDocumentType(initialData.documentType ?? "DDT");
      setDdtNumber(initialData.ddtNumber ?? "");
      setInvoiceNumber(initialData.invoiceNumber ?? "");
      setAmount(initialData.amount ?? 0);
      setPaymentMethod(initialData.paymentMethod ?? "Contanti");
    }
  }, [initialData]);

  const resetForm = useCallback(() => {
    setNomeFornitore("");
    setFornitoreId(0);
    setDocumentType("DDT");
    setDdtNumber("");
    setInvoiceNumber("");
    setAmount(0);
    setPaymentMethod("Contanti");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSelectFornitore = useCallback((item: FornitoreSearchbox) => {
    setFornitoreId(item.fornitoreId);
    setNomeFornitore(item.ragioneSociale);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!fornitoreId || !amount) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Fornitore e importo sono obbligatori",
        autoClose: 2000,
        toastId: "warning-payment",
      });
      return;
    }

    const docNumber = documentType === "FA" ? invoiceNumber : ddtNumber;
    const docLabel = docNumber ? ` - ${documentType} ${docNumber}` : "";
    const description = `Pagamento ${nomeFornitore}${docLabel}`;

    onConfirm({
      description,
      amount,
      isPagamentoFornitore: true,
      fornitoreId,
      ddtNumber: documentType === "DDT" ? ddtNumber : undefined,
      paymentMethod: paymentMethod || undefined,
      documentType,
      invoiceNumber: documentType === "FA" ? invoiceNumber : undefined,
    });
    resetForm();
    onClose();
  }, [fornitoreId, amount, ddtNumber, invoiceNumber, nomeFornitore, paymentMethod, documentType, onConfirm, resetForm, onClose]);

  // initialValues calcolati da initialData per pre-riempire FormikSearchbox (enableReinitialize)
  const initialValues: PaymentFormValues = {
    nomeFornitore: initialData
      ? (initialData.description?.split(" - ")[0]?.replace("Pagamento ", "") ?? "")
      : "",
    fornitoreId: initialData?.fornitoreId ?? 0,
    ddtNumber: initialData?.ddtNumber ?? "",
    amount: initialData?.amount ?? 0,
    paymentMethod: initialData?.paymentMethod ?? "Contanti",
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { overflow: "visible" } }}
    >
      <Formik
        initialValues={initialValues}
        enableReinitialize
        onSubmit={handleConfirm}
      >
        {() => (
          <Form noValidate>
            {/* Titolo differenziato tra modalità aggiunta e modifica */}
            <DialogTitle>{initialData ? "Modifica Pagamento Fornitore" : "Pagamento Fornitore"}</DialogTitle>
            <DialogContent sx={{ overflow: "visible" }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12">
                    <FormikSearchbox<PaymentFormValues, FornitoreSearchbox>
                      label="Fornitore *"
                      placeholder="Seleziona fornitore"
                      name="nomeFornitore"
                      required
                      fullWidth
                      fieldName="ragioneSociale"
                      options={fornitoreSearchboxOption}
                      onSelectItem={handleSelectFornitore}
                    />
                  </div>
                  <div className="col-span-12">
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      <ToggleButtonGroup
                        value={documentType}
                        exclusive
                        onChange={(_e, value) => {
                          if (value) setDocumentType(value);
                        }}
                        size="small"
                      >
                        <ToggleButton value="DDT">DDT</ToggleButton>
                        <ToggleButton value="FA">Fattura</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </div>
                  <div className="col-span-12">
                    {documentType === "DDT" ? (
                      <TextField
                        label="Numero DDT"
                        fullWidth
                        value={ddtNumber}
                        onChange={(e) => setDdtNumber(e.target.value)}
                      />
                    ) : (
                      <TextField
                        label="Numero Fattura"
                        fullWidth
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <TextField
                      label="Importo *"
                      type="number"
                      fullWidth
                      value={amount || ""}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <FormControl fullWidth>
                      <InputLabel>Metodo Pagamento</InputLabel>
                      <Select
                        value={paymentMethod}
                        label="Metodo Pagamento"
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <MenuItem value="Contanti">Contanti</MenuItem>
                        <MenuItem value="Bonifico">Bonifico</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </div>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>Annulla</Button>
              {/* Testo bottone differenziato tra modalità aggiunta e modifica */}
              <Button
                type="submit"
                variant="contained"
                disabled={!fornitoreId || !amount}
              >
                {initialData ? "Aggiorna" : "Conferma"}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}

export default PagamentoFornitoreDialog;
