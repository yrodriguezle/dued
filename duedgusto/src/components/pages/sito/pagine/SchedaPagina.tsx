import { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { StatoPubblicazione } from "./pubblicazionePagina";
import {
  ETICHETTE_PAGINE,
  IMMAGINI_FUORI_GALLERIA,
  PERCORSI_SITO,
  PaginaSito,
  RuoloImmaginePagina,
  immaginiDelRuolo,
  occupatiDellaPagina,
  origineDelRuolo,
  postiDellaPagina,
  ruoliDellaPagina,
} from "./ruoliPagine";
import { larghezzaAnteprima, mediaUrl } from "../mediaUrl";

/**
 * Il guscio delle cinque schede di pagina.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **L'ordine delle risposte è imposto qui, non ripetuto in cinque componenti.** Le tre
 *    domande che l'amministratore pone hanno una precedenza, e non è quella con cui i campi
 *    capitano di essere scritti:
 *
 *      ① la pagina **esiste**?          → prima riga, prima di qualunque campo
 *      ② **quante immagini** ospita?     → capacità, occupati, e cosa rende un posto vuoto
 *      ③ **quali testi** posso cambiare? → i testi di proprietà, modificabili qui
 *      ④ e quelli che non posso?         → i testi ereditati, in sola lettura, con il rimando
 *
 *    Cinque componenti che ricopiassero l'ordine lo perderebbero al primo che aggiunge una
 *    sezione «in fondo, per ora». Le tre risposte sono il **contenuto** della scheda, non la
 *    sua glossa: nessuna sta dentro un pannello a scomparsa, un asterisco o un suggerimento a
 *    comparsa.
 *
 * ⚠️ Il guscio **non monta Formik**: le due schede che non possiedono alcun campo (`/menu`,
 *    `/contatti`) non hanno modulo né pulsante Salva, e un guscio che imponesse un modulo le
 *    costringerebbe a un Salva grigio — cioè a suggerire che manchi qualcosa da compilare.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

interface SchedaPaginaProps {
  pagina: PaginaSito;
  /** ① Lo stato di pubblicazione. `sempre` per le tre pagine che non dipendono da un testo. */
  stato: StatoPubblicazione;
  /** ② Il piano dei ruoli, dallo **stesso** calcolo che alimenta il sito. */
  piano: RuoliImmaginiVetrina | null;
  caricamentoPiano?: boolean;
  /** Il pulsante di scelta dell'immagine del ruolo singolo, quando la pagina ne ha uno. */
  azioneSlot?: ReactNode;
  /** ③ I campi modificabili da questa scheda. Assente sulle schede che non ne hanno. */
  testiPropri?: ReactNode;
  /** Cosa dichiarare al posto del modulo, quando la pagina non possiede alcun testo. */
  senzaTestiPropri?: ReactNode;
  /** ④ I testi che questa pagina rende ma che si cambiano altrove. */
  testiEreditati: ReactNode;
  /** Prodotti, recensioni, orari: sorgenti che la pagina mostra e che non sono testi. */
  altreSorgenti?: ReactNode;
}

/** Una sezione della scheda. Stesso aspetto delle sezioni di «Impostazioni sito». */
export function SezioneScheda({ titolo, descrizione, children }: { titolo: string; descrizione?: string; children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <Typography
        variant="subtitle1"
        fontWeight={600}
        sx={{ mb: descrizione ? 0.5 : 2 }}
      >
        {titolo}
      </Typography>
      {descrizione && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 2 }}
        >
          {descrizione}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

/**
 * Un testo che questa pagina **rende** ma non **possiede**.
 *
 * 🔴 Non è un campo disabilitato: è testo. La differenza si deve vedere **senza provare a
 *    scriverci dentro** — un campo grigio invita comunque a cliccarlo, e chi ci clicca impara
 *    che il pannello a volte non risponde invece di imparare dove si cambia quel valore.
 */
export function TestoEreditato({
  etichetta,
  valore,
  percorso,
  etichettaPercorso,
  nota,
}: {
  etichetta: string;
  valore?: string | null;
  percorso: string;
  etichettaPercorso: string;
  nota?: string;
}) {
  const scritto = typeof valore === "string" && valore.trim() !== "";
  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={600}
        >
          {etichetta}
        </Typography>
        <Chip
          label="Sola lettura"
          size="small"
          variant="outlined"
        />
      </Box>
      <Typography
        variant="body2"
        color={scritto ? "text.primary" : "text.secondary"}
        sx={{ whiteSpace: "pre-line" }}
      >
        {scritto ? valore : "Non compilato."}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 0.25 }}
      >
        Si modifica in{" "}
        <Link
          component={RouterLink}
          to={percorso}
        >
          {etichettaPercorso}
        </Link>
        .{nota ? ` ${nota}` : ""}
      </Typography>
    </Box>
  );
}

/** ① Lo stato di pubblicazione, come prima riga della scheda. */
function RigaStato({ pagina, stato }: { pagina: PaginaSito; stato: StatoPubblicazione }) {
  const nome = ETICHETTE_PAGINE[pagina];
  const percorso = PERCORSI_SITO[pagina];

  if (stato.tipo === "sempre") {
    // ⚠️ NON dice «Pubblicata»: questa pagina non ha uno stato condizionato, e chiamarla
    //    pubblicata suggerirebbe che possa smettere di esserlo.
    return <Alert severity="info">La pagina «{nome}» esiste sempre: {percorso} risponde, compare nella navigazione del sito e nella sitemap. Nessun campo di questa scheda può farla sparire.</Alert>;
  }

  if (stato.pubblicata) {
    return (
      <Alert severity="success">
        <strong>Pubblicata.</strong> {percorso} risponde, compare nella navigazione del sito e nella sitemap. Svuotando «{stato.nomeCampo}» la pagina sparisce dal sito.
      </Alert>
    );
  }

  return (
    <Alert severity="warning">
      <strong>Non pubblicata:</strong> manca «{stato.nomeCampo}», e finché manca la pagina risponde <strong>404</strong>, non compare nella navigazione del sito né nella sitemap. È il testo a farla esistere, non il titolo: un titolo compilato con il testo vuoto la lascia
      non pubblicata.
    </Alert>
  );
}

/** Le immagini che ricoprono un ruolo, in anteprima. */
function AnteprimeRuolo({ immagini }: { immagini: MediaAsset[] }) {
  if (immagini.length === 0) {
    return null;
  }
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
      {immagini.map((immagine) => {
        const larghezza = larghezzaAnteprima(immagine.larghezzeDisponibili);
        return (
          <Box
            key={immagine.mediaAssetId}
            component="img"
            src={larghezza ? mediaUrl(immagine.chiave, larghezza) : undefined}
            alt={immagine.testoAlternativo || immagine.nomeOriginale}
            title={immagine.nomeOriginale}
            sx={{
              width: 96,
              height: 64,
              objectFit: "cover",
              objectPosition: immagine.focale || "center",
              borderRadius: 1,
              backgroundImage: immagine.placeholder ? `url(${immagine.placeholder})` : undefined,
              backgroundSize: "cover",
            }}
          />
        );
      })}
    </Box>
  );
}

/** Una riga della sezione immagini: un ruolo, la sua capacità, il suo riempimento. */
function RigaRuolo({ ruolo, piano, azione }: { ruolo: RuoloImmaginePagina; piano: RuoliImmaginiVetrina | null; azione?: ReactNode }) {
  const immagini = immaginiDelRuolo(piano, ruolo);
  const origine = origineDelRuolo(piano, ruolo);
  const occupati = immagini.length;

  // 🔴 La scheda deve dire **da dove viene** ciò che sta mostrando: «scelta da te» e «è la
  //    prima della galleria, e cambierà» sono due promesse diverse, e la seconda scade appena
  //    qualcuno carica una foto.
  const provenienza = (() => {
    if (origine === "SLOT") {
      return { testo: "Scelta da te: resta questa anche se la galleria cambia.", colore: "success" as const };
    }
    if (occupati > 0) {
      return { testo: `Nessuna scelta: la pagina usa ${ruolo.ripiego}, quindi cambia se la galleria cambia.`, colore: "warning" as const };
    }
    if (ruolo.singolo && ruolo.ripiego === null) {
      // 🔴 L'unico posto del sito che, vuoto, non mostra niente. È una decisione, non un guasto.
      return { testo: "Nessuna immagine scelta: la pagina esce senza immagine di testata. Questo posto non ha ripiego.", colore: "warning" as const };
    }
    return { testo: "Posto vuoto: la galleria non ha abbastanza fotografie pubblicate per riempirlo.", colore: "default" as const };
  })();

  return (
    <Box sx={{ py: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography
          variant="subtitle2"
          fontWeight={600}
        >
          {ruolo.descrizione}
        </Typography>
        <Chip
          label={ruolo.posti === 1 ? `1 posto · ${occupati} occupato` : `${ruolo.posti} posti · ${occupati} occupati`}
          size="small"
          variant="outlined"
        />
        {azione}
      </Box>
      <Typography
        variant="caption"
        color={provenienza.colore === "default" ? "text.secondary" : `${provenienza.colore}.main`}
        sx={{ display: "block", mt: 0.25 }}
      >
        {provenienza.testo}
      </Typography>
      <AnteprimeRuolo immagini={immagini} />
    </Box>
  );
}

/** ② Quante immagini, quante occupate, e cosa succede a un posto vuoto. */
function SezioneImmagini({ pagina, piano, caricamento, azioneSlot }: { pagina: PaginaSito; piano: RuoliImmaginiVetrina | null; caricamento?: boolean; azioneSlot?: ReactNode }) {
  const ruoli = ruoliDellaPagina(pagina);
  const posti = postiDellaPagina(pagina);
  const occupati = occupatiDellaPagina(piano, pagina);
  const fuoriGalleria = IMMAGINI_FUORI_GALLERIA.filter((voce) => voce.pagina === pagina);

  return (
    <SezioneScheda
      titolo="Immagini"
      descrizione="Quanti posti immagine ospita questa pagina, quanti sono occupati adesso e che cosa la pagina rende al posto di quelli vuoti."
    >
      {posti === 0 ? (
        // 🔴 Zero è una risposta, e va scritta: la sezione assente non è una risposta, è la
        //    stessa mancanza di informazione da cui questo pannello nasce.
        <Alert severity="info">Questa pagina non ospita <strong>alcuna immagine</strong>: zero posti. Non c&apos;è nulla da caricare per questa pagina.</Alert>
      ) : (
        <Alert severity="info">
          <strong>
            {posti} {posti === 1 ? "posto immagine" : "posti immagine"} su questa pagina
          </strong>
          , {occupati} {occupati === 1 ? "occupato" : "occupati"} adesso.{caricamento ? " (conteggio in aggiornamento…)" : ""}
        </Alert>
      )}

      {ruoli.map((ruolo) => (
        <RigaRuolo
          key={ruolo.chiave}
          ruolo={ruolo}
          piano={piano}
          azione={ruolo.singolo ? azioneSlot : undefined}
        />
      ))}

      {fuoriGalleria.map((voce) => (
        // 🔴 Dichiarata a parte: non viene dalla galleria e non si sceglie da qui, ma chi conta
        //    le fotografie della pagina la vede lo stesso — tacerla farebbe mentire il numero.
        <Alert
          key={voce.pagina}
          severity="info"
          sx={{ mt: 1 }}
        >
          In più, {voce.quante} {voce.quante === "fino a 3" ? "fotografie arrivano" : "fotografia arriva"} dai <strong>prodotti</strong> e non dalla galleria — {voce.descrizione}. Non contano fra i posti qui sopra e si cambiano da{" "}
          <Link
            component={RouterLink}
            to={voce.percorso}
          >
            {voce.etichettaPercorso}
          </Link>
          .
        </Alert>
      ))}

      {/* ⚠️ L'anteprima social è del SITO, non di una pagina: compare su tutte e non si conta
          in nessuna. Dichiararla su ognuna evita che qualcuno la cerchi qui e la ricarichi. */}
      <Alert
        severity="info"
        sx={{ mt: 1 }}
      >
        L&apos;immagine di <strong>anteprima social</strong> — quella che si vede condividendo un link — è <strong>condivisa da tutte le pagine</strong>, non conta fra i posti di questa e si cambia una volta sola in{" "}
        <Link
          component={RouterLink}
          to="/gestionale/sito/impostazioni"
        >
          Impostazioni sito
        </Link>
        .
      </Alert>
    </SezioneScheda>
  );
}

function SchedaPagina({ pagina, stato, piano, caricamentoPiano, azioneSlot, testiPropri, senzaTestiPropri, testiEreditati, altreSorgenti }: SchedaPaginaProps) {
  return (
    <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, px: 2, py: 2 }}>
      <Box sx={{ maxWidth: 1000, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Typography
          variant="caption"
          color="text.secondary"
        >
          Scheda della pagina <strong>{ETICHETTE_PAGINE[pagina]}</strong> del sito — indirizzo pubblico <code>{PERCORSI_SITO[pagina]}</code>
        </Typography>

        {/* ① Esiste? */}
        <RigaStato
          pagina={pagina}
          stato={stato}
        />

        {/* ② Quante immagini? */}
        <SezioneImmagini
          pagina={pagina}
          piano={piano}
          caricamento={caricamentoPiano}
          azioneSlot={azioneSlot}
        />

        {/* ③ Quali testi posso cambiare da qui? */}
        <SezioneScheda
          titolo="Testi di questa pagina"
          descrizione="Si modificano qui, e solo qui."
        >
          {testiPropri ?? senzaTestiPropri}
        </SezioneScheda>

        {/* ④ E quelli che non posso? */}
        <SezioneScheda
          titolo="Testi ereditati dal sito"
          descrizione="Questa pagina li mostra ma non li possiede: si modificano dove sono dichiarati, una volta sola per tutte le pagine che li usano."
        >
          {testiEreditati}
        </SezioneScheda>

        {altreSorgenti}
      </Box>
    </Box>
  );
}

export default SchedaPagina;
