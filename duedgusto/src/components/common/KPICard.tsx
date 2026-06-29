import { Paper, Typography } from "@mui/material";
import formatCurrency from "../../common/bones/formatCurrency";

interface KPICardProps {
  label: string;
  value: number;
  highlight?: boolean;
  negative?: boolean;
}

function KPICard({ label, value, highlight, negative }: KPICardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        textAlign: "center",
        flex: "1 1 auto",
        minWidth: "100px",
        ...(highlight && { borderColor: "primary.main", borderWidth: 2 }),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        noWrap
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight="bold"
        color={negative ? "error.main" : "text.primary"}
        noWrap
      >
        {formatCurrency(value)}
      </Typography>
    </Paper>
  );
}

export default KPICard;
