import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  Box,
} from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";

interface CashCountTableProps {
  denominations: CashDenomination[];
  fieldName: "openingCounts" | "closingCounts";
  title: string;
}

function CashCountTable({ denominations, fieldName, title }: CashCountTableProps) {
  const formik = useFormikContext<FormikCashRegisterValues>();

  const getCoinDenominations = () => denominations.filter((d) => d.type === "COIN");
  const getBanknoteDenominations = () => {
    const banknotes = denominations.filter((d) => d.type === "BANKNOTE");
    // Per l'apertura cassa, escludi banconote da 10, 20, 50 e 100 euro
    if (fieldName === "openingCounts") {
      return banknotes.filter((d) => d.value !== 10 && d.value !== 20 && d.value !== 50 && d.value !== 100);
    }
    return banknotes;
  };

  const getQuantity = (denominationId: number): number => {
    const count = formik.values[fieldName]?.find((c) => c.denominationId === denominationId);
    return count?.quantity || 0;
  };

  const handleQuantityChange = (denominationId: number, value: string) => {
    const quantity = parseInt(value) || 0;
    const counts = formik.values[fieldName] || [];
    const existingIndex = counts.findIndex((c) => c.denominationId === denominationId);

    if (existingIndex >= 0) {
      const newCounts = [...counts];
      newCounts[existingIndex] = { denominationId, quantity };
      formik.setFieldValue(fieldName, newCounts);
    } else {
      formik.setFieldValue(fieldName, [...counts, { denominationId, quantity }]);
    }
  };

  const calculateTotal = (): number => {
    return (formik.values[fieldName] || []).reduce((sum, count) => {
      const denomination = denominations.find((d) => d.denominationId === count.denominationId);
      return sum + (denomination ? denomination.value * count.quantity : 0);
    }, 0);
  };

  const renderDenominationRow = (denomination: CashDenomination) => {
    const quantity = getQuantity(denomination.denominationId);
    const total = denomination.value * quantity;

    return (
      <TableRow key={denomination.denominationId}>
        <TableCell sx={{ py: { xs: 1.5, sm: 1 } }}>
          <Typography variant="body1" fontWeight="medium" sx={{ fontSize: { xs: "1rem", sm: "0.875rem" } }}>
            {denomination.value.toFixed(2)}€
          </Typography>
        </TableCell>
        <TableCell align="center" sx={{ py: { xs: 1.5, sm: 1 } }}>
          <TextField
            type="number"
            size="medium"
            value={quantity}
            onChange={(e) => handleQuantityChange(denomination.denominationId, e.target.value)}
            inputProps={{
              min: 0,
              style: { textAlign: "center", fontSize: "1.1rem" },
              inputMode: "numeric"
            }}
            sx={{
              width: { xs: "100px", sm: "80px" },
              "& .MuiInputBase-input": {
                padding: { xs: "12px", sm: "8px" }
              }
            }}
          />
        </TableCell>
        <TableCell align="right" sx={{ py: { xs: 1.5, sm: 1 } }}>
          <Typography variant="body1" sx={{ fontSize: { xs: "1rem", sm: "0.875rem" } }}>
            {total.toFixed(2)}€
          </Typography>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 2 }}>
        {title}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ py: { xs: 1.5, sm: 1 } }}>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: "1rem", sm: "0.875rem" } }}
                >
                  Taglio
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ py: { xs: 1.5, sm: 1 } }}>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: "1rem", sm: "0.875rem" } }}
                >
                  Quantità
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ py: { xs: 1.5, sm: 1 } }}>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: "1rem", sm: "0.875rem" } }}
                >
                  Totale
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Monete */}
            <TableRow>
              <TableCell
                colSpan={3}
                sx={{
                  bgcolor: "action.hover",
                  py: { xs: 1.5, sm: 1.25 }
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: "1.1rem", sm: "0.875rem" } }}
                >
                  MONETE
                </Typography>
              </TableCell>
            </TableRow>
            {getCoinDenominations().map(renderDenominationRow)}

            {/* Banconote */}
            <TableRow>
              <TableCell
                colSpan={3}
                sx={{
                  bgcolor: "action.hover",
                  py: { xs: 1.5, sm: 1.25 },
                  mt: { xs: 2, sm: 1 }
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: "1.1rem", sm: "0.875rem" } }}
                >
                  BANCONOTE
                </Typography>
              </TableCell>
            </TableRow>
            {getBanknoteDenominations().map(renderDenominationRow)}

            {/* Totale */}
            <TableRow>
              <TableCell colSpan={2} sx={{ py: { xs: 2, sm: 1.5 } }}>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: "1.2rem", sm: "1rem" } }}
                >
                  TOTALE
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ py: { xs: 2, sm: 1.5 } }}>
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  color="primary"
                  sx={{ fontSize: { xs: "1.5rem", sm: "1.25rem" } }}
                >
                  {calculateTotal().toFixed(2)}€
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default CashCountTable;
