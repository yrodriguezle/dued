import { Box } from "@mui/material";
import { useFormikContext } from "formik";
import OperatingHoursSection from "./OperatingHoursSection";
import OperatingDaysSection from "./OperatingDaysSection";

function BusinessSettingsForm() {
  const { errors, touched } = useFormikContext<BusinessSettings>();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Sezione Orari */}
      <OperatingHoursSection errors={errors as Record<string, string | undefined>} touched={touched as Record<string, boolean>} />

      {/* Sezione Giorni Operativi */}
      <OperatingDaysSection errors={errors as Record<string, string | undefined>} touched={touched as Record<string, boolean>} />
    </Box>
  );
}

export default BusinessSettingsForm;
