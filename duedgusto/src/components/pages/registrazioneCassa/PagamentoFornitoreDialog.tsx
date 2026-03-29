import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem, Autocomplete, CircularProgress, Typography } from "@mui/material";
import { useLazyQuery } from "@apollo/client";
import NumberField from "../../common/form/NumberField";
import DateField from "../../common/form/DateField";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import fornitoreSearchboxOption, { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import showToast from "../../../common/toast/showToast";
import { Formik, Form } from "formik";
import { getFattureNonPagatePerFornitore, getDdtNonPagatiPerFornitore } from "../../../graphql/cashRegister/queries";

const DEFAULT_ALIQUOTA_IVA = 22;

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

interface FatturaOption {
  fatturaId: number;
  numeroFattura: string;
  dataFattura: string;
  imponibile: number;
  totaleConIva?: number | null;
  stato: string;
  residuo: number;
}

interface DdtOption {
  ddtId: number;
  numeroDdt: string;
  dataDdt: string;
  importo: number;
}

function PagamentoFornitoreDialog({ open, onClose, onConfirm, initialData }: PagamentoFornitoreDialogProps) {
  const [nomeFornitore, setNomeFornitore] = useState("");
  const [fornitoreId, setFornitoreId] = useState<number>(0);
  const [documentType, setDocumentType] = useState<"FA" | "DDT">("DDT");
  const [ddtNumber, setDdtNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("Contanti");

  // Aliquota IVA (solo per fatture)
  const [aliquotaIva, setAliquotaIva] = useState<number>(DEFAULT_ALIQUOTA_IVA);

  // Nuovi campi per collegamento fatture/DDT
  const [fatturaId, setFatturaId] = useState<number | undefined>(undefined);
  const [ddtId, setDdtId] = useState<number | undefined>(undefined);
  const [dataFattura, setDataFattura] = useState<string | undefined>(undefined);
  const [dataDdt, setDataDdt] = useState<string | undefined>(undefined);
  const [selectedFattura, setSelectedFattura] = useState<FatturaOption | null>(null);
  const [selectedDdt, setSelectedDdt] = useState<DdtOption | null>(null);

  // Lazy queries per fatture e DDT non pagati
  const [fetchFatture, { data: fattureData, loading: fattureLoading }] = useLazyQuery(getFattureNonPagatePerFornitore, { fetchPolicy: "network-only" });
  const [fetchDdt, { data: ddtData, loading: ddtLoading }] = useLazyQuery(getDdtNonPagatiPerFornitore, { fetchPolicy: "network-only" });

  // Calcola opzioni fatture con residuo (usa totaleConIva se disponibile, altrimenti imponibile per fatture vecchie)
  const fattureOptions: FatturaOption[] = (fattureData?.gestioneCassa?.fattureNonPagatePerFornitore ?? []).map((f) => {
    const totalePagato = f.pagamenti?.reduce((sum, p) => sum + p.importo, 0) ?? 0;
    const totaleFattura = f.totaleConIva ?? f.imponibile;
    return {
      fatturaId: f.fatturaId,
      numeroFattura: f.numeroFattura,
      dataFattura: f.dataFattura,
      imponibile: f.imponibile,
      totaleConIva: f.totaleConIva,
      stato: f.stato,
      residuo: totaleFattura - totalePagato,
    };
  });

  const ddtOptions: DdtOption[] = ddtData?.gestioneCassa?.ddtNonPagatiPerFornitore ?? [];

  // Quando cambia il fornitore, carica fatture/DDT
  useEffect(() => {
    if (fornitoreId > 0) {
      if (documentType === "FA") {
        fetchFatture({ variables: { fornitoreId } });
      } else {
        fetchDdt({ variables: { fornitoreId } });
      }
    }
  }, [fornitoreId, documentType, fetchFatture, fetchDdt]);

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
      setAliquotaIva(initialData.aliquotaIva ?? DEFAULT_ALIQUOTA_IVA);
      setFatturaId(initialData.fatturaId);
      setDdtId(initialData.ddtId);
      setDataFattura(initialData.dataFattura);
      setDataDdt(initialData.dataDdt);
      // Non possiamo pre-selezionare l'Autocomplete finché la query non ritorna,
      // ma i campi saranno già compilati
      setSelectedFattura(null);
      setSelectedDdt(null);
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
    setAliquotaIva(DEFAULT_ALIQUOTA_IVA);
    setFatturaId(undefined);
    setDdtId(undefined);
    setDataFattura(undefined);
    setDataDdt(undefined);
    setSelectedFattura(null);
    setSelectedDdt(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSelectFornitore = useCallback((item: FornitoreSearchbox) => {
    setFornitoreId(item.fornitoreId);
    setNomeFornitore(item.ragioneSociale);
    // Pre-compila aliquota IVA dal fornitore selezionato (se disponibile)
    setAliquotaIva(item.aliquotaIva ?? DEFAULT_ALIQUOTA_IVA);
    // Reset selezione documento quando cambia fornitore
    setSelectedFattura(null);
    setSelectedDdt(null);
    setFatturaId(undefined);
    setDdtId(undefined);
    setDataFattura(undefined);
    setDataDdt(undefined);
  }, []);

  const handleSelectFattura = useCallback((_event: unknown, value: FatturaOption | null) => {
    setSelectedFattura(value);
    if (value) {
      setFatturaId(value.fatturaId);
      setInvoiceNumber(value.numeroFattura);
      setDataFattura(value.dataFattura);
      // Suggerisci il residuo come importo predefinito
      if (!amount || amount === 0) {
        setAmount(value.residuo);
      }
    } else {
      setFatturaId(undefined);
      setInvoiceNumber("");
      setDataFattura(undefined);
    }
  }, [amount]);

  const handleSelectDdt = useCallback((_event: unknown, value: DdtOption | null) => {
    setSelectedDdt(value);
    if (value) {
      setDdtId(value.ddtId);
      setDdtNumber(value.numeroDdt);
      setDataDdt(value.dataDdt);
      // Suggerisci l'importo del DDT come predefinito
      if (!amount || amount === 0) {
        setAmount(value.importo);
      }
    } else {
      setDdtId(undefined);
      setDdtNumber("");
      setDataDdt(undefined);
    }
  }, [amount]);

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
      pagamentoId: initialData?.pagamentoId,
      fatturaId: documentType === "FA" ? fatturaId : undefined,
      ddtId: documentType === "DDT" ? ddtId : undefined,
      dataFattura: documentType === "FA" ? dataFattura : undefined,
      dataDdt: documentType === "DDT" ? dataDdt : undefined,
      aliquotaIva: documentType === "FA" ? aliquotaIva : undefined,
    });
    resetForm();
    onClose();
  }, [fornitoreId, amount, ddtNumber, invoiceNumber, nomeFornitore, paymentMethod, documentType, onConfirm, resetForm, onClose, initialData?.pagamentoId, fatturaId, ddtId, dataFattura, dataDdt, aliquotaIva]);

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

  // Formatta data ISO in formato italiano (dd/mm/yyyy)
  const formatDateLabel = (isoDate?: string): string => {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("it-IT");
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
                          if (value) {
                            setDocumentType(value);
                            // Reset selezione quando cambia tipo documento
                            setSelectedFattura(null);
                            setSelectedDdt(null);
                            setFatturaId(undefined);
                            setDdtId(undefined);
                            setDataFattura(undefined);
                            setDataDdt(undefined);
                            setInvoiceNumber("");
                            setDdtNumber("");
                          }
                        }}
                        size="small"
                      >
                        <ToggleButton value="DDT">DDT</ToggleButton>
                        <ToggleButton value="FA">Fattura</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </div>

                  {/* Ricerca documenti esistenti */}
                  {fornitoreId > 0 && documentType === "FA" && (
                    <div className="col-span-12">
                      <Autocomplete
                        options={fattureOptions}
                        value={selectedFattura}
                        onChange={handleSelectFattura}
                        loading={fattureLoading}
                        getOptionLabel={(option) => {
                          const totale = option.totaleConIva ?? option.imponibile;
                          return `FA ${option.numeroFattura} - ${formatDateLabel(option.dataFattura)} - €${totale.toFixed(2)} (Residuo: €${option.residuo.toFixed(2)}, Stato: ${option.stato})`;
                        }}
                        isOptionEqualToValue={(option, value) => option.fatturaId === value.fatturaId}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Cerca fattura non pagata"
                            placeholder="Seleziona una fattura esistente..."
                            size="small"
                            slotProps={{
                              input: {
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {fattureLoading ? <CircularProgress
                                      color="inherit"
                                      size={20}
                                    /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              },
                            }}
                          />
                        )}
                        noOptionsText="Nessuna fattura non pagata"
                      />
                    </div>
                  )}

                  {fornitoreId > 0 && documentType === "DDT" && (
                    <div className="col-span-12">
                      <Autocomplete
                        options={ddtOptions}
                        value={selectedDdt}
                        onChange={handleSelectDdt}
                        loading={ddtLoading}
                        getOptionLabel={(option) =>
                          `DDT ${option.numeroDdt} - ${formatDateLabel(option.dataDdt)} - €${option.importo.toFixed(2)}`
                        }
                        isOptionEqualToValue={(option, value) => option.ddtId === value.ddtId}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Cerca DDT non pagato"
                            placeholder="Seleziona un DDT esistente..."
                            size="small"
                            slotProps={{
                              input: {
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {ddtLoading ? <CircularProgress
                                      color="inherit"
                                      size={20}
                                    /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              },
                            }}
                          />
                        )}
                        noOptionsText="Nessun DDT non pagato"
                      />
                    </div>
                  )}

                  <div className="col-span-12">
                    {documentType === "DDT" ? (
                      <TextField
                        label="Numero DDT"
                        fullWidth
                        value={ddtNumber}
                        onChange={(e) => setDdtNumber(e.target.value)}
                        disabled={!!selectedDdt}
                      />
                    ) : (
                      <TextField
                        label="Numero Fattura"
                        fullWidth
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        disabled={!!selectedFattura}
                      />
                    )}
                  </div>

                  {/* Data documento (manuale se nessun documento selezionato) */}
                  {documentType === "FA" && !selectedFattura && (
                    <div className="col-span-12">
                      <DateField
                        name="dataFattura"
                        label="Data Fattura"
                        fullWidth
                        value={dataFattura ?? ""}
                        onChange={(_name, value) => setDataFattura(value || undefined)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </div>
                  )}
                  {documentType === "FA" && selectedFattura && (
                    <div className="col-span-12">
                      <TextField
                        label="Data Fattura"
                        fullWidth
                        value={formatDateLabel(dataFattura)}
                        disabled
                      />
                    </div>
                  )}
                  {documentType === "DDT" && !selectedDdt && (
                    <div className="col-span-12">
                      <DateField
                        name="dataDdt"
                        label="Data DDT"
                        fullWidth
                        value={dataDdt ?? ""}
                        onChange={(_name, value) => setDataDdt(value || undefined)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </div>
                  )}
                  {documentType === "DDT" && selectedDdt && (
                    <div className="col-span-12">
                      <TextField
                        label="Data DDT"
                        fullWidth
                        value={formatDateLabel(dataDdt)}
                        disabled
                      />
                    </div>
                  )}

                  <div className="col-span-12 md:col-span-6">
                    <NumberField
                      name="amount"
                      label="Importo *"
                      fullWidth
                      value={amount}
                      onChange={(_name, value) => setAmount(value)}
                      decimals={2}
                    />
                  </div>

                  {/* Aliquota IVA - solo per fatture */}
                  {documentType === "FA" && (
                    <div className="col-span-12 md:col-span-6">
                      <NumberField
                        name="aliquotaIva"
                        label="Aliquota IVA %"
                        fullWidth
                        value={aliquotaIva}
                        onChange={(_name, value) => setAliquotaIva(value)}
                        decimals={0}
                      />
                    </div>
                  )}

                  {/* Preview calcolo IVA - solo per fatture con importo > 0 */}
                  {documentType === "FA" && amount > 0 && aliquotaIva > 0 && (
                    <div className="col-span-12">
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: -1 }}
                      >
                        {(() => {
                          const imponibile = amount / (1 + aliquotaIva / 100);
                          const ivaAmount = amount - imponibile;
                          return `Imponibile: €${imponibile.toFixed(2)} | IVA: €${ivaAmount.toFixed(2)}`;
                        })()}
                      </Typography>
                    </div>
                  )}

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
