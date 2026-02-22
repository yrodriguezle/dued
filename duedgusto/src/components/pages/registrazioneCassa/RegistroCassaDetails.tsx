import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { Box, Typography, Toolbar, IconButton } from "@mui/material";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SaveIcon from "@mui/icons-material/Save";
import LockIcon from "@mui/icons-material/Lock";
import { useParams, useNavigate } from "react-router";
import { useApolloClient } from "@apollo/client";
import { GridReadyEvent } from "ag-grid-community";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";

import CashRegisterFormDataGrid from "./CashRegisterFormDataGrid";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";
import logger from "../../../common/logger/logger";
import { formStatuses } from "../../../common/globals/constants";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryDenominations from "../../../graphql/cashRegister/useQueryDenominations";
import useQueryCashRegister from "../../../graphql/cashRegister/useQueryCashRegister";
import useSubmitCashRegister from "../../../graphql/cashRegister/useSubmitCashRegister";
import { PagamentoFornitoreRegistroInput, RegistroCassaInput } from "../../../graphql/cashRegister/mutations";
import useCloseCashRegister from "../../../graphql/cashRegister/useCloseCashRegister";
import { getRegistroCassa } from "../../../graphql/cashRegister/queries";
import useStore from "../../../store/useStore";
import { toast } from "react-toastify";
import { getCurrentDate, getFormattedDate, getWeekdayName, parseDateForGraphQL } from "../../../common/date/date";
import useCashCountData from "./useCashCountData";

// Schema per Formik - solo campi del form, NON include dati delle griglie
const Schema = z.object({
  registerId: z.number().optional(),
  date: z.string().nonempty("La data è obbligatoria"),
  utenteId: z.number(),
  notes: z.string(),
  status: z.enum(["DRAFT", "CLOSED", "RECONCILED"]),
  gridDirty: z.boolean().default(false),
});

export type FormikCashRegisterValues = z.infer<typeof Schema>;

// Types per i dati delle griglie (gestiti separatamente da Formik)
export interface CashCount {
  denominazioneMonetaId: number;
  quantita: number;
}

export interface Income extends Record<string, unknown> {
  type: string;
  amount: number;
}

export interface Expense extends Record<string, unknown> {
  description: string;
  amount: number;
  isSupplierPayment?: boolean;
  supplierId?: number;
  ddtNumber?: string;
  paymentMethod?: string;
  documentType?: "FA" | "DDT";
  invoiceNumber?: string;
}

interface CashCountRow extends Record<string, unknown> {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

interface IncomeRow extends Record<string, unknown> {
  type: string;
  amount: number;
}

interface ExpenseRow extends Record<string, unknown> {
  description: string;
  amount: number;
}

function RegistroCassaDetails() {
  const { date: dateParam } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const formRef = useRef<FormikProps<FormikCashRegisterValues>>(null);
  const openingGridRef = useRef<GridReadyEvent<DatagridData<CashCountRow>> | null>(null);
  const closingGridRef = useRef<GridReadyEvent<DatagridData<CashCountRow>> | null>(null);
  const incomesGridRef = useRef<GridReadyEvent<DatagridData<IncomeRow>> | null>(null);
  const expensesGridRef = useRef<GridReadyEvent<DatagridData<ExpenseRow>> | null>(null);
  const { setTitle } = useContext(PageTitleContext);
  const client = useApolloClient();
  const utente = useStore((state) => state.utente);
  const isOpen = useStore((state) => state.isOpen);
  const getNextOperatingDate = useStore((state) => state.getNextOperatingDate);

  // refreshKey: incrementato quando una griglia notifica un cambio, forza il ricalcolo del SummaryDataGrid
  const [refreshKey, setRefreshKey] = useState(0);
  const handleCellChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Stati per i dati iniziali delle griglie - mantengono referenza stabile
  const [initialOpeningCounts, setInitialOpeningCounts] = useState<CashCount[]>([]);
  const [initialClosingCounts, setInitialClosingCounts] = useState<CashCount[]>([]);
  const [initialIncomes, setInitialIncomes] = useState<Income[]>([]);
  const [initialExpenses, setInitialExpenses] = useState<Expense[]>([]);

  // Usa il parametro date dall'URL, altrimenti usa la data corrente
  const getInitialDate = useCallback(() => {
    return dateParam || getCurrentDate("YYYY-MM-DD");
  }, [dateParam]);

  const [currentDate, setCurrentDate] = useState<string>(getInitialDate());

  // Aggiorna currentDate quando cambia l'URL
  useEffect(() => {
    const newDate = getInitialDate();
    setCurrentDate(newDate);
  }, [getInitialDate]);

  const { initialValues, handleInitializeValues } = useInitializeValues({
    skipInitialize: !currentDate,
    utenteId: utente?.id || 0,
    currentDate,
  });

  const { denominazioni, loading: loadingDenominations } = useQueryDenominations();

  const { cashRegister, loading: loadingCashRegister } = useQueryCashRegister({
    data: parseDateForGraphQL(currentDate) ?? "",
    skip: !currentDate,
  });

  // Prepara i dati per le griglie di apertura e chiusura
  const { openingRowData, closingRowData } = useCashCountData({
    denominations: denominazioni,
    openingCounts: initialOpeningCounts,
    closingCounts: initialClosingCounts,
  });

  // Navigate between days for cash register entry, skipping non-operating days
  const handlePreviousDay = useCallback(() => {
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    for (let i = 0; i < 7; i++) {
      date.setDate(date.getDate() - 1);
      if (isOpen(date)) break;
    }
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/${newDate}`);
  }, [currentDate, isOpen, navigate]);

  const handleNextDay = useCallback(() => {
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    for (let i = 0; i < 7; i++) {
      date.setDate(date.getDate() + 1);
      if (isOpen(date)) break;
    }
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/${newDate}`);
  }, [currentDate, isOpen, navigate]);

  const handleOpenMonthlyCalendar = useCallback(() => {
    // Estrai anno e mese dalla data corrente nell'URL
    const [year, month] = currentDate.split("-").map(Number);
    navigate(`/gestionale/cassa/monthly?year=${year}&month=${month}`);
  }, [currentDate, navigate]);

  // Copia i conteggi chiusura del giorno operativo precedente come apertura
  const handleCopyFromPrevious = useCallback(async () => {
    // Calcola la data del giorno operativo precedente
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    Array.from({ length: 7 }).some(() => {
      date.setDate(date.getDate() - 1);
      return isOpen(date);
    });
    const prevDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const parsedPrevDate = parseDateForGraphQL(prevDate);
    if (!parsedPrevDate) return;

    try {
      const { data } = await client.query({
        query: getRegistroCassa,
        variables: { data: parsedPrevDate },
        fetchPolicy: "network-only",
      });

      const registro = data?.cashManagement?.registroCassa;
      if (!registro?.conteggiChiusura?.length) {
        toast.warning("Nessun dato di chiusura trovato per il giorno precedente");
        return;
      }

      const copiedCounts: CashCount[] = registro.conteggiChiusura.map((c: ConteggioMoneta) => {
        // Per la denominazione con valore 5.00€ forza quantita = 2
        const denomination = denominazioni.find((d: DenominazioneMoneta) => d.id === c.denominazioneMonetaId);
        const quantita = denomination && denomination.valore === 5 ? 2 : c.quantita;
        return {
          denominazioneMonetaId: c.denominazioneMonetaId,
          quantita,
        };
      });

      setInitialOpeningCounts(copiedCounts);
      handleCellChange();
      toast.success("Conteggi apertura copiati dal giorno precedente");
    } catch (error) {
      logger.error("Errore durante la copia dal giorno precedente:", error);
      toast.error("Errore durante la copia dal giorno precedente");
    }
  }, [currentDate, isOpen, client, denominazioni, handleCellChange]);

  const { submitCashRegister } = useSubmitCashRegister();
  const { closeCashRegister, loading: closing } = useCloseCashRegister();
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione Cassa");
  }, [setTitle]);

  // Initialize form with cash register data when available
  useEffect(() => {
    if (cashRegister) {
      logger.log("Loading cashRegister from server", cashRegister);

      // Convert date from ISO 8601 to YYYY-MM-DD
      const dateStr = cashRegister.data.split("T")[0]; // Extract YYYY-MM-DD from ISO string

      // Popola i valori del form (solo campi non-griglia)
      const formikValues: FormikCashRegisterValues = {
        registerId: cashRegister.id,
        date: dateStr,
        utenteId: cashRegister.utenteId,
        notes: cashRegister.note || "",
        status: cashRegister.stato,
        gridDirty: false,
      };
      handleInitializeValues(formikValues);

      // Popola i dati iniziali delle griglie
      setInitialOpeningCounts(
        cashRegister.conteggiApertura?.map((c: ConteggioMoneta) => ({
          denominazioneMonetaId: c.denominazioneMonetaId,
          quantita: c.quantita,
        })) || []
      );

      setInitialClosingCounts(
        cashRegister.conteggiChiusura?.map((c: ConteggioMoneta) => ({
          denominazioneMonetaId: c.denominazioneMonetaId,
          quantita: c.quantita,
        })) || []
      );

      setInitialIncomes(
        cashRegister.incassi && cashRegister.incassi.length > 0
          ? cashRegister.incassi.map((i: IncassoCassa) => ({ type: i.tipo, amount: i.importo }))
          : [
            { type: "Pago in contanti", amount: cashRegister.incassoContanteTracciato || 0 },
            { type: "Pagamenti Elettronici", amount: cashRegister.incassiElettronici || 0 },
            { type: "Pagamento con Fattura", amount: cashRegister.incassiFattura || 0 },
          ]
      );

      // Ricostruisci le spese: spese normali + pagamenti fornitore
      const normalExpenses: Expense[] = cashRegister.spese?.map((e: SpesaCassa) => ({
        description: e.descrizione,
        amount: e.importo,
      })) || [];
      const supplierPaymentExpenses: Expense[] = cashRegister.pagamentiFornitori?.map(
        (p: PagamentoFornitoreRegistro) => {
          const hasInvoice = !!p.invoice;
          const supplierName = hasInvoice
            ? (p.invoice?.supplier?.businessName || "Fornitore")
            : (p.ddt?.supplier?.businessName || "Fornitore");
          const supplierId = hasInvoice
            ? p.invoice?.supplier?.supplierId
            : p.ddt?.supplier?.supplierId;
          const docType: "FA" | "DDT" = hasInvoice ? "FA" : "DDT";
          const docLabel = hasInvoice
            ? `FA ${p.invoice?.invoiceNumber || ""}`
            : `DDT ${p.ddt?.ddtNumber || ""}`;

          return {
            description: `Pagamento ${supplierName} - ${docLabel}`,
            amount: p.amount,
            isSupplierPayment: true,
            supplierId,
            ddtNumber: p.ddt?.ddtNumber,
            paymentMethod: p.paymentMethod,
            documentType: docType,
            invoiceNumber: p.invoice?.invoiceNumber,
          };
        }
      ) || [];
      setInitialExpenses([...supplierPaymentExpenses, ...normalExpenses]);

      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: cashRegister.stato !== "DRAFT",
        });
      }, 0);
    } else {
      // Initialize with current date for new entry
      const newFormikValues: FormikCashRegisterValues = {
        date: currentDate,
        utenteId: utente?.id || 0,
        notes: "",
        status: "DRAFT",
        gridDirty: false,
      };
      handleInitializeValues(newFormikValues);

      // Popola i dati iniziali delle griglie per nuova registrazione
      setInitialOpeningCounts([]);
      setInitialClosingCounts([]);
      setInitialIncomes([
        { type: "Pago in contanti", amount: 0 },
        { type: "Pagamenti Elettronici", amount: 0 },
        { type: "Pagamento con Fattura", amount: 0 },
      ]);
      setInitialExpenses([]);

      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.INSERT,
          isFormLocked: false,
        });
      }, 0);
    }
  }, [cashRegister, handleInitializeValues, currentDate, utente?.id]);

  const onSubmit = async (values: FormikCashRegisterValues) => {
    try {
      openingGridRef.current?.api.stopEditing();
      closingGridRef.current?.api.stopEditing();
      incomesGridRef.current?.api.stopEditing();
      expensesGridRef.current?.api.stopEditing();

      // Leggi i dati dalle griglie
      const openingCounts = openingGridRef.current?.context.getGridData() || [];
      const closingCounts = closingGridRef.current?.context.getGridData() || [];
      const incomes = incomesGridRef.current?.context.getGridData() || [];
      const expenses = expensesGridRef.current?.context.getGridData() || [];

      // Converti la data in formato GraphQL (ISO 8601 UTC)
      const parsedDate = parseDateForGraphQL(values.date);
      if (!parsedDate) {
        toast.error("Data non valida");
        return;
      }

      // Separa spese normali da pagamenti fornitore
      const normalExpenses = expenses.filter((row: Expense) => !row.isSupplierPayment);
      const supplierPayments: PagamentoFornitoreRegistroInput[] = expenses
        .filter((row: Expense) => row.isSupplierPayment && row.supplierId)
        .map((row: Expense) => ({
          fornitoreId: row.supplierId!,
          numeroDdt: row.ddtNumber || "",
          importo: row.amount,
          metodoPagamento: row.paymentMethod || undefined,
          tipoDocumento: row.documentType || "DDT",
          numeroFattura: row.invoiceNumber || undefined,
        }));

      // Converti gli array in campi per il backend (nomi italiani)
      const input: RegistroCassaInput = {
        id: values.registerId,
        data: parsedDate,
        utenteId: values.utenteId,
        conteggiApertura: openingCounts.map((row: CashCountRow) => ({
          denominazioneMonetaId: row.denominationId,
          quantita: row.quantity,
        })),
        conteggiChiusura: closingCounts.map((row: CashCountRow) => ({
          denominazioneMonetaId: row.denominationId,
          quantita: row.quantity,
        })),
        incassi: incomes.map((row: IncomeRow) => ({
          tipo: row.type,
          importo: row.amount,
        })),
        spese: normalExpenses.map((row: ExpenseRow) => ({
          descrizione: row.description,
          importo: row.amount,
        })),
        pagamentiFornitori: supplierPayments,
        incassoContanteTracciato: incomes.find((i: IncomeRow) => i.type === "Pago in contanti")?.amount || 0,
        incassiElettronici: incomes.find((i: IncomeRow) => i.type === "Pagamenti Elettronici")?.amount || 0,
        incassiFattura: incomes.find((i: IncomeRow) => i.type === "Pagamento con Fattura")?.amount || 0,
        speseFornitori: 0, // Non più usato, calcolato dal backend
        speseGiornaliere: 0, // Non più usato, calcolato dal backend
        note: values.notes,
        stato: values.status as StatoRegistroCassa,
      };

      logger.log("onSubmit - input to be sent", input);

      const result = await submitCashRegister({ registroCassa: input });

      if (result) {
        toast.success("Cassa salvata con successo!");

        // Aggiorna il form con l'ID ritornato dal server
        // Questo assicura che i successivi salvataggi siano update
        if (result.id && !formRef.current?.values.registerId) {
          formRef.current?.setFieldValue("registerId", result.id);
        }

        // Dopo il salvataggio, aggiorna lo stato del form
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: false,
        });
      }
    } catch (error) {
      logger.error("Errore durante il salvataggio:", error);
      toast.error("Errore durante il salvataggio della cassa");
    }
  };

  const handleCloseCashRegister = async () => {
    const confirmed = await onConfirm({
      title: "Chiudi Cassa",
      content: "Sei sicuro di voler chiudere definitivamente la cassa? Non sarà più possibile modificarla.",
      acceptLabel: "Si, chiudi",
      cancelLabel: "Annulla",
    });

    if (!confirmed || !formRef.current?.values.registerId) {
      return;
    }

    try {
      await closeCashRegister(formRef.current.values.registerId);
      toast.success("Cassa chiusa con successo!");
      formRef.current?.setStatus({
        formStatus: formStatuses.UPDATE,
        isFormLocked: true,
      });
    } catch (error) {
      logger.error("Errore durante la chiusura:", error);
      toast.error("Errore durante la chiusura della cassa");
    }
  };

  // Redirect se il giorno corrente è non operativo
  useEffect(() => {
    const [y, m, d] = currentDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (!isOpen(date)) {
      const next = getNextOperatingDate(date);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      navigate(`/gestionale/cassa/${nextStr}`, { replace: true });
    }
  }, [currentDate, isOpen, getNextOperatingDate, navigate]);

  if (loadingDenominations || loadingCashRegister) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <Typography variant="h6">Caricamento...</Typography>
      </Box>
    );
  }

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikCashRegisterValues) => {
        const result = Schema.safeParse(values);
        if (result.success) {
          return;
        }
        return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
      }}
      onSubmit={onSubmit}
    >
      {({ status, isSubmitting, isValid }) => {
        const disableSave = status?.isFormLocked || isSubmitting || !isValid;

        return (
          <Form noValidate>
            {/* Toolbar in stile FormikToolbar */}
            <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
              <Toolbar
                variant="dense"
                disableGutters
                sx={{
                  minHeight: 48,
                  height: 48,
                  display: "flex",
                  justifyContent: "space-between",
                  px: 2,
                }}
              >
                {/* Bottoni azione a sinistra */}
                <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
                  <FormikToolbarButton
                    startIcon={<SaveIcon />}
                    disabled={disableSave}
                    type="submit"
                  >
                    Salva
                  </FormikToolbarButton>
                  {status?.formStatus === formStatuses.UPDATE && status?.isFormLocked === false && (
                    <FormikToolbarButton
                      startIcon={<LockIcon />}
                      onClick={handleCloseCashRegister}
                      disabled={closing}
                      color="warning"
                    >
                      Chiudi Cassa
                    </FormikToolbarButton>
                  )}
                </Box>

                {/* Navigazione date al centro/destra */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <IconButton size="small" onClick={handlePreviousDay} title="Giorno precedente">
                    <ArrowBack fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ minWidth: 200, textAlign: "center" }}>
                    {getWeekdayName(currentDate)} - {getFormattedDate(currentDate, "DD/MM/YYYY")}
                  </Typography>
                  <IconButton size="small" onClick={handleNextDay} title="Giorno successivo">
                    <ArrowForward fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={handleOpenMonthlyCalendar} title="Vista mensile" color="primary">
                    <CalendarMonthIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Toolbar>
            </Box>

            {/* Contenuto principale */}
            <Box sx={{ paddingX: { xs: 1, sm: 2 }, paddingTop: 2, paddingBottom: 3 }}>
              <CashRegisterFormDataGrid
                openingGridRef={openingGridRef}
                closingGridRef={closingGridRef}
                incomesGridRef={incomesGridRef}
                expensesGridRef={expensesGridRef}
                openingRowData={openingRowData}
                closingRowData={closingRowData}
                initialIncomes={initialIncomes}
                initialExpenses={initialExpenses}
                onCellChange={handleCellChange}
                onCopyFromPrevious={handleCopyFromPrevious}
                refreshKey={refreshKey}
              />
            </Box>
          </Form>
        );
      }}
    </Formik>
  );
}

export default RegistroCassaDetails;
