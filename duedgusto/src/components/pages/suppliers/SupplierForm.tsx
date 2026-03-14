import { Paper, Typography, Box } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";
import FormikCheckbox from "../../common/form/FormikCheckbox";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import supplierSearchboxOption, { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import { FormikSupplierValues } from "./SupplierDetails";

interface SupplierFormProps {
  onSelectItem: (item: SupplierSearchbox) => void;
}

function SupplierForm({ onSelectItem }: SupplierFormProps) {
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
            <FormikSearchbox<FormikSupplierValues, SupplierSearchbox>
              label="Ragione Sociale *"
              placeholder="Ragione Sociale"
              name="businessName"
              autoFocus
              required
              fullWidth
              fieldName="businessName"
              options={supplierSearchboxOption}
              onSelectItem={onSelectItem}
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikCheckbox
              name="active"
              label="Attivo"
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <FormikTextField
              name="vatNumber"
              label="Partita IVA"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-6">
            <FormikTextField
              name="fiscalCode"
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
              name="phone"
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
              name="address"
              label="Indirizzo"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikTextField
              name="postalCode"
              label="CAP"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikTextField
              name="city"
              label="Citta"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikTextField
              name="province"
              label="Provincia"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikTextField
              name="country"
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
              name="notes"
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

export default SupplierForm;
