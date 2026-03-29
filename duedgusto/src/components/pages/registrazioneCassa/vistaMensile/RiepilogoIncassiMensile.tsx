import { Box, Typography, Divider, Chip, useMediaQuery, useTheme } from "@mui/material";
import formatCurrency from "../../../../common/bones/formatCurrency";

interface MonthlyStats {
  totaleVendite: number;
  contanti: number;
  elettronici: number;
  fatture: number;
  spese: number;
  registri: number;
  chiusi: number;
  bozze: number;
}

interface RiepilogoIncassiMensileProps {
  stats: MonthlyStats;
}

function RiepilogoIncassiMensile({ stats }: RiepilogoIncassiMensileProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 1.5 } }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 1.5, sm: 2.5 } }}>
        <Box sx={{ minWidth: { xs: "auto", sm: 100 } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1 }}
          >
            Totale Vendite
          </Typography>
          <Typography
            variant={isMobile ? "body2" : "body1"}
            fontWeight="bold"
            color="primary.main"
            sx={{ lineHeight: 1.3 }}
          >
            {`\u20AC ${formatCurrency(stats.totaleVendite)}`}
          </Typography>
        </Box>
        {!isMobile && <Divider
          orientation="vertical"
          flexItem
        />}
        <Box sx={{ minWidth: { xs: "auto", sm: 90 } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1 }}
          >
            Contanti
          </Typography>
          <Typography
            variant={isMobile ? "body2" : "body1"}
            fontWeight="bold"
            color="success.main"
            sx={{ lineHeight: 1.3 }}
          >
            {`\u20AC ${formatCurrency(stats.contanti)}`}
          </Typography>
        </Box>
        {!isMobile && <Divider
          orientation="vertical"
          flexItem
        />}
        <Box sx={{ minWidth: { xs: "auto", sm: 90 } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1 }}
          >
            Elettronici
          </Typography>
          <Typography
            variant={isMobile ? "body2" : "body1"}
            fontWeight="bold"
            color="warning.main"
            sx={{ lineHeight: 1.3 }}
          >
            {`\u20AC ${formatCurrency(stats.elettronici)}`}
          </Typography>
        </Box>
        {!isMobile && <Divider
          orientation="vertical"
          flexItem
        />}
        <Box sx={{ minWidth: { xs: "auto", sm: 80 } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1 }}
          >
            Fatture
          </Typography>
          <Typography
            variant={isMobile ? "body2" : "body1"}
            fontWeight="bold"
            sx={{ lineHeight: 1.3 }}
          >
            {`\u20AC ${formatCurrency(stats.fatture)}`}
          </Typography>
        </Box>
        {!isMobile && <Divider
          orientation="vertical"
          flexItem
        />}
        <Box sx={{ minWidth: { xs: "auto", sm: 80 } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1 }}
          >
            Spese
          </Typography>
          <Typography
            variant={isMobile ? "body2" : "body1"}
            fontWeight="bold"
            color="error.main"
            sx={{ lineHeight: 1.3 }}
          >
            {stats.spese > 0 ? `-\u20AC ${formatCurrency(stats.spese)}` : `\u20AC ${formatCurrency(0)}`}
          </Typography>
        </Box>
        {!isMobile && <Divider
          orientation="vertical"
          flexItem
        />}
        <Box sx={{ minWidth: { xs: "auto", sm: 80 } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1 }}
          >
            Netto
          </Typography>
          <Typography
            variant={isMobile ? "body2" : "body1"}
            fontWeight="bold"
            color="primary.main"
            sx={{ lineHeight: 1.3 }}
          >
            {`\u20AC ${formatCurrency(stats.totaleVendite - stats.spese)}`}
          </Typography>
        </Box>
        {!isMobile && <Divider
          orientation="vertical"
          flexItem
        />}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Chip
            label={`${stats.registri} registri`}
            size="small"
            variant="outlined"
          />
          {stats.bozze > 0 && <Chip
            label={`${stats.bozze} bozze`}
            size="small"
            color="warning"
            variant="outlined"
          />}
        </Box>
      </Box>
    </Box>
  );
}

export default RiepilogoIncassiMensile;
