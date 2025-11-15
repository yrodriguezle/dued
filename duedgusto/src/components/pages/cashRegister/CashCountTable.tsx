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
  const getBanknoteDenominations = () => denominations.filter((d) => d.type === "BANKNOTE");

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
        <TableCell>
          <Typography variant="body2" fontWeight="medium">
            {denomination.value.toFixed(2)}€
          </Typography>
        </TableCell>
        <TableCell align="center">
          <TextField
            type="number"
            size="small"
            value={quantity}
            onChange={(e) => handleQuantityChange(denomination.denominationId, e.target.value)}
            inputProps={{ min: 0, style: { textAlign: "center" } }}
            sx={{ width: "80px" }}
          />
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{total.toFixed(2)}€</Typography>
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
              <TableCell>
                <Typography variant="subtitle2" fontWeight="bold">
                  Taglio
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="subtitle2" fontWeight="bold">
                  Quantità
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2" fontWeight="bold">
                  Totale
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Monete */}
            <TableRow>
              <TableCell colSpan={3} sx={{ bgcolor: "action.hover" }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  MONETE
                </Typography>
              </TableCell>
            </TableRow>
            {getCoinDenominations().map(renderDenominationRow)}

            {/* Banconote */}
            <TableRow>
              <TableCell colSpan={3} sx={{ bgcolor: "action.hover", pt: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  BANCONOTE
                </Typography>
              </TableCell>
            </TableRow>
            {getBanknoteDenominations().map(renderDenominationRow)}

            {/* Totale */}
            <TableRow>
              <TableCell colSpan={2}>
                <Typography variant="subtitle1" fontWeight="bold">
                  TOTALE
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6" fontWeight="bold" color="primary">
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
