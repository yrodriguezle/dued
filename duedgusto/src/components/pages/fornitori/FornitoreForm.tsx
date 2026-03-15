import { Paper, Typography, Box } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";
import FormikCheckbox from "../../common/form/FormikCheckbox";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import fornitoreSearchboxOption, { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import { FormikFornitoreValues } from "./FornitoreDetails";

interface FornitoreFormProps {
  onSelectItem: (item: FornitoreSearchbox) => void;
}

function FornitoreForm({ onSelectItem }: FornitoreFormProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Dati Generali */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Dati Generali
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-8">
            <FormikSearchbox<FormikFornitoreValues, FornitoreSearchbox>
              label="Ragione Sociale *"
              placeholder="Ragione Sociale"
              name="ragioneSociale"
              autoFocus
              required
              fullWidth
              fieldName="ragioneSociale"
              options={fornitoreSearchboxOption}
              onSelectItem={onSelectItem}
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikCheckbox
              name="attivo"
              label="Attivo"
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <FormikTextField
              name="partitaIva"
              label="Partita IVA"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <FormikTextField
              name="codiceFiscale"
              label="Codice Fiscale"
              fullWidth
            />
          </div>
        </div>
      </Paper>

      {/* Sezione: Contatti */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Contatti
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6">
            <FormikTextField
              name="email"
              label="Email"
              type="email"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <FormikTextField
              name="telefono"
              label="Telefono"
              fullWidth
            />
          </div>
        </div>
      </Paper>

      {/* Sezione: Indirizzo */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Indirizzo
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-9">
            <FormikTextField
              name="indirizzo"
              label="Indirizzo"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikTextField
              name="cap"
              label="CAP"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikTextField
              name="citta"
              label="Citta"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikTextField
              name="provincia"
              label="Provincia"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikTextField
              name="paese"
              label="Paese"
              fullWidth
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
              name="note"
              label="Note"
              fullWidth
              multiline
              rows={4}
            />
          </div>
        </div>
      </Paper>
    </Box>
  );
}

export default FornitoreForm;
