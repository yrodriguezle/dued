import { Paper, Typography, Box, useTheme } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import fornitoreSearchboxOption, { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import fatturaAcquistoSearchboxOption, { FatturaAcquistoSearchbox } from "../../common/form/searchbox/searchboxOptions/fatturaAcquistoSearchboxOptions";
import { FormikDocumentoTrasportoValues } from "./DocumentoTrasportoDetails";

interface DocumentoTrasportoFormProps {
  onSelectFornitore: (item: FornitoreSearchbox) => void;
  onSelectInvoice: (item: FatturaAcquistoSearchbox) => void;
}

function DocumentoTrasportoForm({ onSelectFornitore, onSelectInvoice }: DocumentoTrasportoFormProps) {
  const theme = useTheme();
  const dateColorScheme = theme.palette.mode === "dark" ? "dark" : "light";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Fornitore e DDT */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Fornitore e DDT
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6">
            <FormikSearchbox<FormikDocumentoTrasportoValues, FornitoreSearchbox>
              label="Fornitore *"
              placeholder="Seleziona fornitore"
              name="nomeFornitore"
              required
              fullWidth
              fieldName="ragioneSociale"
              options={fornitoreSearchboxOption}
              onSelectItem={onSelectFornitore}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikTextField
              name="ddtNumber"
              label="Numero DDT *"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikTextField
              name="ddtDate"
              label="Data DDT *"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ "& input": { colorScheme: dateColorScheme } }}
            />
          </div>
        </div>
      </Paper>

      {/* Sezione: Importo e Fattura Collegata */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Importo e Fattura Collegata
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3">
            <FormikTextField
              name="amount"
              label="Importo"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
            />
          </div>
          <div className="col-span-12 md:col-span-9">
            <FormikSearchbox<FormikDocumentoTrasportoValues, FatturaAcquistoSearchbox>
              label="Fattura"
              placeholder="Cerca fattura"
              name="invoiceNumber"
              fullWidth
              fieldName="numeroFattura"
              options={fatturaAcquistoSearchboxOption}
              onSelectItem={onSelectInvoice}
            />
          </div>
        </div>
      </Paper>

      {/* Sezione: Note */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Note
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <FormikTextField
              name="notes"
              label="Note"
              fullWidth
              multiline
              rows={3}
            />
          </div>
        </div>
      </Paper>
    </Box>
  );
}

export default DocumentoTrasportoForm;
