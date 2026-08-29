import ButtonBase from "@mui/material/ButtonBase";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

/**
 * Le tinte offerte per il tastone di un gruppo: **le stesse dieci del listino**, non una
 * tavolozza generica.
 *
 * <p>🔴 Sono i valori pieni delle categorie di <c>coloriProdotto</c> — la banda satura che
 * separa una tessera dalla vicina al banco. Chi compone un gruppo ha già imparato quelle
 * associazioni guardando la griglia: offrirgliene altre gliene farebbe imparare due serie.</p>
 *
 * <p>⚠️ Sono scritte a mano e non derivate a runtime da <c>CATEGORIE_NOTE</c> di proposito: qui
 * finiscono <b>nel database</b>, e un colore che cambia perché qualcuno ha ritoccato una tinta
 * del listino ridipingerebbe in silenzio gruppi che nessuno ha toccato.</p>
 */
const TINTE_DEL_BANCO: readonly { nome: string; valore: string }[] = [
  { nome: "Spritz", valore: "#d1321a" },
  { nome: "Caffè", valore: "#aa6d41" },
  { nome: "Brioche", valore: "#cab321" },
  { nome: "Cucina", valore: "#65a744" },
  { nome: "Prosecco", valore: "#41aa6d" },
  { nome: "Bibite", valore: "#2dabbe" },
  { nome: "Birra", valore: "#3163b9" },
  { nome: "Liquori", valore: "#6041aa" },
  { nome: "Cocktail", valore: "#ab35b6" },
  { nome: "Vino", valore: "#b63564" },
];

interface SceltaColoreGruppoProps {
  /** Il colore corrente. Stringa vuota significa «automatico», come `null` a database. */
  valore: string;
  onCambia: (colore: string) => void;
}

/**
 * La scelta del colore del tastone, **a pastiglie e non a esadecimale**.
 *
 * <p>🔴 Il campo di testo che chiedeva <c>#F4801A</c> presupponeva che chi configura il banco
 * sappia scrivere un colore in cifre. Non lo sa, e non deve impararlo: qui il colore si sceglie
 * guardandolo, che è anche il solo modo di sapere se sta bene accanto agli altri tastoni.</p>
 *
 * <p>⚠️ «Automatico» resta la prima pastiglia e non un'assenza di scelta: il ripiego generato
 * dalla categoria dei membri è un esito legittimo, e va potuto <b>ripristinare</b> dopo aver
 * provato una tinta.</p>
 */
function SceltaColoreGruppo({ valore, onCambia }: SceltaColoreGruppoProps) {
  const corrente = valore.trim();
  const fuoriTavolozza = Boolean(corrente) && !TINTE_DEL_BANCO.some((tinta) => tinta.valore === corrente);

  const pastiglia = (colore: string, etichetta: string, selezionata: boolean) => (
    <Tooltip
      key={colore || "auto"}
      title={etichetta}
    >
      <ButtonBase
        aria-label={`Colore ${etichetta}`}
        aria-pressed={selezionata}
        onClick={() => onCambia(colore)}
        sx={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          bgcolor: colore || "transparent",
          // La pastiglia «automatico» è un cerchio vuoto: dire «nessun colore» con un colore
          // sarebbe una contraddizione, e un grigio pieno si leggerebbe come una tinta grigia.
          border: colore ? "none" : "1px dashed",
          borderColor: "text.disabled",
          outline: selezionata ? "2px solid" : "none",
          outlineColor: "text.primary",
          outlineOffset: 2,
          transition: "transform 80ms ease-out",
          "&:hover": { transform: "scale(1.12)" },
          "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
        }}
      />
    </Tooltip>
  );

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{ mb: 0.5 }}
      >
        Colore del tastone
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        {pastiglia("", "automatico", !corrente)}
        {TINTE_DEL_BANCO.map((tinta) => pastiglia(tinta.valore, tinta.nome, corrente === tinta.valore))}
        {/* Un colore già a database che non sta fra i dieci non si perde e non si nasconde:
            resta selezionabile, altrimenti riaprire il gruppo lo cancellerebbe al primo salva. */}
        {fuoriTavolozza && pastiglia(corrente, "scelto in precedenza", true)}
      </Box>
    </Box>
  );
}

export default SceltaColoreGruppo;
