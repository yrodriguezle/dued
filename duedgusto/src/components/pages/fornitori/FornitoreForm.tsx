import { Paper } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";
import FormikNumberField from "../../common/form/FormikNumberField";
import FormikCheckbox from "../../common/form/FormikCheckbox";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import fornitoreSearchboxOption, { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import { FormikFornitoreValues } from "./FornitoreDetails";

interface FornitoreFormProps {
  onSelectItem: (item: FornitoreSearchbox) => void;
}

function FornitoreForm({ onSelectItem }: FornitoreFormProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
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
        <div className="col-span-12 md:col-span-6">
          <FormikTextField
            name="ragioneSociale2"
            label="Ragione Sociale 2"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FormikTextField
            name="partitaIva"
            label="Partita IVA"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FormikTextField
            name="codiceFiscale"
            label="Codice Fiscale"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-2">
          <FormikNumberField
            name="aliquotaIva"
            label="Aliquota IVA %"
            fullWidth
            decimals={2}
          />
        </div>
        <div className="col-span-12 md:col-span-2 flex items-center">
          <FormikCheckbox
            name="attivo"
            label="Attivo"
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FormikTextField
            name="email"
            label="Email"
            type="email"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FormikTextField
            name="telefono"
            label="Telefono"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FormikTextField
            name="indirizzo"
            label="Indirizzo"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-2">
          <FormikTextField
            name="cap"
            label="CAP"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <FormikTextField
            name="citta"
            label="Città"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <FormikTextField
            name="provincia"
            label="Provincia"
            fullWidth
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <FormikTextField
            name="paese"
            label="Paese"
            fullWidth
          />
        </div>
        <div className="col-span-12">
          <FormikTextField
            name="note"
            label="Note"
            fullWidth
            multiline
            rows={3}
          />
        </div>
      </div>
    </Paper>
  );
}

export default FornitoreForm;
