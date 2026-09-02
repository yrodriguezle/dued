import { useContext, useEffect, useMemo } from "react";
import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

import SchedaPagina, { SezioneScheda } from "./SchedaPagina";
import { useDatiScheda } from "./datiScheda";
import SitoGuard from "../SitoGuard";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../../graphql/common/useGetAll";
import { prodottoVetrinaFragment } from "../../../../graphql/vetrina/fragments";

/**
 * La scheda della pagina **Menu** del sito.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **Nessun modulo, nessun pulsante «Salva», nessuna mutation** — e non è una mancanza.
 *    Questa pagina non possiede alcun campo: mostra il listino (che vive nei prodotti),
 *    l'insegna (che vive nelle impostazioni) e tre fotografie della galleria. Un modulo vuoto
 *    con un Salva grigio sarebbe **peggio** di non metterlo: suggerirebbe che manchi qualcosa
 *    da compilare, e chi lo cerca perderebbe tempo a cercare cosa.
 *
 *    La scheda è una **mappa** di ciò che governa la pagina altrove, ed è precisamente la
 *    risposta che l'amministratore cerca: «dove si cambia quello che vedo qui».
 *
 * ⚠️ **L'etichetta resta «Menu», identica a quella del sito.** Il gestionale ha già una sezione
 *    «Menu» — l'anagrafica delle voci di navigazione — e la collisione si risolve con
 *    l'annidamento sotto «Sito» e con l'icona, non rinominando: rispecchiare il sito è il punto
 *    di questa sezione.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
function PaginaMenu() {
  const { setTitle } = useContext(PageTitleContext);
  const { impostazioni, piano, mappa, caricamento, caricamentoPiano, errore } = useDatiScheda();

  // Il conteggio arriva dal campo che il **server** calcola (`attivo && visibileSulSito`): il
  // pannello non riapplica la regola, altrimenti sarebbe un secondo criterio di pubblicazione.
  const { data: prodotti, loading: caricamentoProdotti } = useGetAll<ProdottoVetrina>({
    fragment: prodottoVetrinaFragment,
    queryName: "prodotti",
    fragmentBody: "...ProdottoVetrinaFragment",
  });

  const pubblicati = useMemo(() => prodotti.filter((prodotto) => prodotto.pubblicatoSulSito).length, [prodotti]);

  useEffect(() => {
    setTitle("Sito — Menu");
  }, [setTitle]);

  if (caricamento) {
    return (
      <SitoGuard>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50dvh" }}>
          <CircularProgress />
        </Box>
      </SitoGuard>
    );
  }

  if (errore) {
    return (
      <SitoGuard>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">Errore nel caricamento della scheda «Menu»: {errore.message}</Alert>
        </Box>
      </SitoGuard>
    );
  }

  return (
    <SitoGuard>
      <Box sx={{ display: "flex", flexDirection: "column", height: "calc(var(--app-height, 100dvh) - 48px)" }}>
        <SchedaPagina
          pagina="menu"
          stato={{ tipo: "sempre" }}
          piano={piano}
          caricamentoPiano={caricamentoPiano}
          mappa={mappa}
          impostazioni={impostazioni}
          senzaTestiPropri={
            <>
              <Alert severity="info">
                Questa pagina <strong>non possiede alcun testo</strong>: non c&apos;è nulla da compilare qui, ed è la ragione per cui questa scheda non ha un pulsante «Salva». Tutto ciò che la pagina mostra si cambia dove è dichiarato, ed è elencato qui sotto.
              </Alert>
              {/* 🔴 Un testo che il sito scrive nel proprio sorgente e che nessun campo governa
                  va DICHIARATO, non trasformato in un campo: un campo che si compila e non
                  produce alcun effetto è un difetto, ed è la stessa regola già applicata ai
                  ganci spenti delle prenotazioni. */}
              <Alert
                severity="warning"
                sx={{ mt: 2 }}
              >
                La <strong>descrizione per i motori di ricerca</strong> di questa pagina è scritta <strong>nel sorgente del sito</strong> (<code>menu.astro</code>) e non è modificabile da qui: non esiste alcun campo che la governi, e cambiarla richiede una
                modifica al sito. Le altre pagine usano invece la descrizione predefinita delle impostazioni.
              </Alert>
            </>
          }
          altreSorgenti={
            <SezioneScheda
              titolo="Il listino"
              descrizione="Il contenuto vero di questa pagina. Non si modifica da qui: questa scheda non è una seconda griglia dei prodotti."
            >
              <Typography variant="body2">
                {caricamentoProdotti ? (
                  "Conteggio dei prodotti in corso…"
                ) : (
                  <>
                    <strong>{pubblicati}</strong> {pubblicati === 1 ? "prodotto pubblicato" : "prodotti pubblicati"} sul sito, su {prodotti.length} in anagrafica.
                  </>
                )}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.5 }}
              >
                Un prodotto compare sul sito quando è <strong>attivo</strong> in cassa <strong>e</strong> marcato come visibile sul sito. Si curano da{" "}
                <Link
                  component={RouterLink}
                  to="/gestionale/sito/prodotti"
                >
                  Prodotti vetrina
                </Link>
                .
              </Typography>
            </SezioneScheda>
          }
        />
      </Box>
    </SitoGuard>
  );
}

export default PaginaMenu;
