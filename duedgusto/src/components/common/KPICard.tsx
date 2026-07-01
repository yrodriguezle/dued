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
        flex: "0 0 auto",
        width: "120px",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        ...(highlight && { borderColor: "primary.main", borderWidth: 2 }),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        noWrap
        sx={{ width: "100%" }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight="bold"
        color={negative ? "error.main" : "text.primary"}
        noWrap
        sx={{ width: "100%" }}
      >
        {formatCurrency(value)}
      </Typography>
    </Paper>
  );
}

export default KPICard;
