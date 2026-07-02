import { useMemo } from "react";
import { Box, Chip, Paper, Typography } from "@mui/material";
import formatCurrency from "../../../common/bones/formatCurrency";
import KPICard from "../../common/KPICard";

interface RiepilogoCardsProps {
  riepilogoGiornaliero: RiepilogoGiornaliero;
  registroCassa?: RegistroCassa | null;
}

function RiepilogoCards({ riepilogoGiornaliero, registroCassa }: RiepilogoCardsProps) {
  const { totaleApertura, totaleChiusura, incassi, totaleSpese, speseScontrino } = riepilogoGiornaliero;

  const {
    totaleMenoApertura,
    pagatoContanti,
    elettronico,
    totaleVedite,
    supplierExpenses,
    resto,
    ecc,
    restoFinale,
  } = useMemo(() => {
    const totaleMenoApertura = totaleChiusura - totaleApertura;
    const pagatoContanti = incassi.find((i) => i.tipo === "Pago in contanti")?.importo ?? 0;
    const elettronico = incassi.find((i) => i.tipo === "Pagamenti Elettronici")?.importo ?? 0;
    const pagamentoConFattura = incassi.find((i) => i.tipo === "Pagamento con Fattura")?.importo ?? 0;
    const totaleVedite = totaleMenoApertura + elettronico + pagamentoConFattura;

    // Spese solo fornitori = totale spese - spese scontrino
    const supplierExpenses = totaleSpese - speseScontrino;
    // AD: Resto fornitore = Contanti - Spese fornitori
    const restoValue = pagatoContanti - supplierExpenses;
    // AE: ECC = Movimento - Contanti
    const eccValue = totaleMenoApertura - pagatoContanti;
    // AG: Resto finale = ECC - NC ecc (spese scontrino)
    const restoFinaleValue = eccValue - speseScontrino;

    return {
      totaleMenoApertura,
      pagatoContanti,
      elettronico,
      totaleVedite,
      supplierExpenses,
      resto: restoValue,
      ecc: eccValue,
      restoFinale: restoFinaleValue,
    };
  }, [totaleChiusura, totaleApertura, incassi, totaleSpese, speseScontrino]);

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      <KPICard
        label="Totale - apertura"
        value={totaleMenoApertura}
      />
      <KPICard
        label="Pagato contanti"
        value={pagatoContanti}
      />
      <KPICard
        label="Elettronico"
        value={elettronico}
      />
      <KPICard
        label="Totale vendite"
        value={totaleVedite}
        highlight
      />
      <KPICard
        label="Spese fornitori"
        value={supplierExpenses}
        negative
      />
      <KPICard
        label="Resto fornitore"
        value={resto}
      />
      <KPICard
        label="ECC"
        value={ecc}
      />
      <KPICard
        label="Spese ecc"
        value={speseScontrino}
      />
      <KPICard
        label="Resto"
        value={restoFinale}
        highlight
      />
      {registroCassa && (registroCassa.breakdownIva?.length ?? 0) > 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 1, flexBasis: "100%" }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
          >
            IVA su vendite (totale € {formatCurrency(registroCassa.importoIva)})
          </Typography>
          {registroCassa.breakdownIva.map((riga) => (
            <Box
              key={`${riga.aliquota}-${riga.stimato}`}
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Typography variant="body2">
                {riga.aliquota}% — Imponibile € {formatCurrency(riga.imponibile)} · IVA € {formatCurrency(riga.imposta)}
              </Typography>
              {riga.stimato && (
                <Chip
                  size="small"
                  color="warning"
                  label="stimato"
                />
              )}
            </Box>
          ))}
        </Paper>
      )}
      {registroCassa && (registroCassa.breakdownIvaCredito?.length ?? 0) > 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 1, flexBasis: "100%" }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
          >
            IVA su pagamenti fornitori — stima (totale €{" "}
            {formatCurrency(registroCassa.breakdownIvaCredito.reduce((acc, r) => acc + r.imposta, 0))})
          </Typography>
          {registroCassa.breakdownIvaCredito.map((riga) => (
            <Box
              key={`${riga.fonte}-${riga.aliquota}-${riga.stimato}-${riga.aliquotaMista}`}
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Typography variant="body2">
                {riga.aliquota}% ({riga.fonte === "FATTURA" ? "fattura" : "DDT"}) — Imponibile €{" "}
                {formatCurrency(riga.imponibile)} · IVA € {formatCurrency(riga.imposta)}
              </Typography>
              {riga.stimato && (
                <Chip
                  size="small"
                  color="warning"
                  label="stimato"
                />
              )}
              {riga.aliquotaMista && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label="aliquota mista"
                />
              )}
            </Box>
          ))}
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mt: 0.5, fontStyle: "italic" }}
          >
            Dato gestionale di cassa (IVA sui pagamenti del giorno), non fiscale. Non sostituisce il registro
            IVA acquisti né la liquidazione periodica.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default RiepilogoCards;
