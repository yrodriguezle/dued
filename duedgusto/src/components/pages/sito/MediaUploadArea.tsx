import { useCallback, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import useUploadMedia from "../../../graphql/vetrina/useUploadMedia";

/**
 * Due caricamenti alla volta, non di più: il backend serializza l'elaborazione delle immagini
 * con un semaforo da 2 e restituisce 503 a chi aspetta troppo. Inviarne otto insieme
 * significa sei richieste in coda che possono scadere — la stessa foto rifiutata per un
 * motivo che con la foto non c'entra nulla.
 */
const CARICAMENTI_CONTEMPORANEI = 2;

interface MediaUploadAreaProps {
  /** Costanti lette dal server: il client non ne ha una copia propria. */
  configurazione: MediaConfigurazione | null;
  cartella: string;
  /** Invocata a batch concluso: la cache Apollo non sa nulla di un upload REST. */
  onCompletato: () => void;
}

type FileScartato = {
  nomeFile: string;
  messaggio: string;
};

function megabyte(byte: number): string {
  return `${Math.round(byte / (1024 * 1024))} MB`;
}

function MediaUploadArea({ configurazione, cartella, onCompletato }: MediaUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const contatoreRef = useRef(0);
  const [trascinamento, setTrascinamento] = useState(false);
  const [scartati, setScartati] = useState<FileScartato[]>([]);
  const { caricaMedia, avanzamenti, azzeraAvanzamenti, caricamentiInCorso } = useUploadMedia();

  /**
   * Il pre-check usa **le costanti del server**, non una soglia scritta qui: un file da 30 MB
   * viene fermato prima che parta un solo byte, e il messaggio resta vero anche il giorno in
   * cui il limite cambia da una parte sola.
   */
  const motivoDiScarto = useCallback(
    (file: File): string | null => {
      if (!configurazione) {
        return null;
      }
      if (file.size > configurazione.maxByteFile) {
        return `supera il limite di ${megabyte(configurazione.maxByteFile)}`;
      }
      if (file.type && !configurazione.mimeAmmessi.includes(file.type)) {
        return `non è un formato ammesso (${configurazione.mimeAmmessi.join(", ")})`;
      }
      return null;
    },
    [configurazione]
  );

  const caricaTutti = useCallback(
    async (files: File[]) => {
      if (!files.length) {
        return;
      }
      azzeraAvanzamenti();

      const respinti = files.map((file) => ({ file, motivo: motivoDiScarto(file) })).filter((esito) => esito.motivo !== null);
      setScartati(respinti.map((esito) => ({ nomeFile: esito.file.name, messaggio: `${esito.file.name} ${esito.motivo}` })));

      const coda = files.filter((file) => motivoDiScarto(file) === null);
      if (!coda.length) {
        return;
      }

      // Due "lavoratori" che pescano dalla stessa coda finché non è vuota: la concorrenza
      // resta a 2 qualunque sia il numero di file selezionati.
      const lavora = async (): Promise<void> => {
        const prossimo = coda.shift();
        if (!prossimo) {
          return;
        }
        contatoreRef.current += 1;
        await caricaMedia(`${contatoreRef.current}-${prossimo.name}`, prossimo, { cartella });
        return lavora();
      };

      await Promise.all(Array.from({ length: CARICAMENTI_CONTEMPORANEI }, () => lavora()));
      onCompletato();
    },
    [azzeraAvanzamenti, caricaMedia, cartella, motivoDiScarto, onCompletato]
  );

  const handleSelezione = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      // Azzera il valore: riselezionare lo stesso file non emetterebbe un secondo change.
      event.target.value = "";
      void caricaTutti(files);
    },
    [caricaTutti]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setTrascinamento(false);
      void caricaTutti(Array.from(event.dataTransfer.files || []));
    },
    [caricaTutti]
  );

  const righeAvanzamento = Object.entries(avanzamenti);

  return (
    <Paper
      variant="outlined"
      onDragOver={(event) => {
        event.preventDefault();
        setTrascinamento(true);
      }}
      onDragLeave={() => setTrascinamento(false)}
      onDrop={handleDrop}
      sx={{
        p: 3,
        mb: 3,
        textAlign: "center",
        borderStyle: "dashed",
        borderWidth: 2,
        borderColor: trascinamento ? "primary.main" : "divider",
        bgcolor: trascinamento ? "action.hover" : "background.paper",
      }}
    >
      <CloudUploadIcon
        color="action"
        sx={{ fontSize: 40 }}
      />
      <Typography
        variant="subtitle1"
        sx={{ mt: 1 }}
      >
        Trascina qui le immagini, oppure
      </Typography>
      <Button
        variant="contained"
        sx={{ mt: 1 }}
        disabled={!configurazione || caricamentiInCorso}
        onClick={() => inputRef.current?.click()}
      >
        Scegli i file
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={configurazione?.mimeAmmessi.join(",")}
        onChange={handleSelezione}
      />
      {configurazione && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: 1 }}
        >
          Massimo {megabyte(configurazione.maxByteFile)} e {configurazione.maxMegapixel} megapixel per immagine. Cartella di destinazione: <strong>{cartella}</strong>.
        </Typography>
      )}

      {scartati.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mt: 2, textAlign: "left" }}
          onClose={() => setScartati([])}
        >
          {scartati.map((scartato) => (
            <div key={scartato.nomeFile}>{scartato.messaggio}</div>
          ))}
        </Alert>
      )}

      {righeAvanzamento.length > 0 && (
        <Box sx={{ mt: 2, textAlign: "left" }}>
          {righeAvanzamento.map(([chiave, avanzamento]) => (
            <Box
              key={chiave}
              sx={{ mb: 1 }}
            >
              <Typography
                variant="caption"
                color={avanzamento.stato === "errore" ? "error" : "text.secondary"}
              >
                {avanzamento.nomeFile}
                {avanzamento.stato === "errore" ? ` — ${avanzamento.messaggio}` : ""}
                {avanzamento.stato === "completato" ? " — caricato" : ""}
              </Typography>
              <LinearProgress
                variant="determinate"
                color={avanzamento.stato === "errore" ? "error" : "primary"}
                value={Math.round(avanzamento.avanzamento * 100)}
              />
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

export default MediaUploadArea;
