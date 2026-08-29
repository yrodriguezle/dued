import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import TesseraProdotto from "./TesseraProdotto";
import formatCurrency from "../../../common/bones/formatCurrency";
import { coloreProdotto } from "./coloriProdotto";

interface VariantiGruppoProps {
  /** Il gruppo aperto, o `null` a cassetto chiuso. */
  gruppo: GruppoProdotti | null;
  onChiudi: () => void;
  onTocca: (prodotto: ProdottoVendibile) => void;
}

/**
 * Le varianti di un gruppo: **una griglia di tastoni, non una lista**.
 *
 * <p>🔴 <b>Pulsanti e non AG Grid</b>, al contrario della pagina di gestione. Qui si sta dietro
 * il bancone con una mano sola: la griglia dati è lo strumento giusto per amministrare il
 * listino, ed è quello sbagliato per battere una consumazione mentre si tiene un bicchiere.</p>
 *
 * <p>⚠️ <b>Il cassetto si chiude da sé dopo il tocco.</b> Aprire «Spritz», battere l'Aperol e
 * restare dentro il gruppo costringerebbe a un tocco in più per tornare alla griglia; e chi
 * volesse due Aperol tocca due volte lo stesso tastone dalla griglia, che è un gesto più corto
 * di quello che si risparmierebbe restando dentro.</p>
 *
 * <p>ℹ️ Il colore di ogni variante è quello <b>esplicito</b> del prodotto quando c'è — Aperol
 * arancione, Campari rosso, Cynar viola — e ricade sul generato quando manca. È dentro un gruppo
 * che quella distinzione paga: fuori le varianti sono lontane fra loro, qui sono cinque tessere
 * adiacenti che si scelgono senza leggere.</p>
 */
function VariantiGruppo({ gruppo, onChiudi, onTocca }: VariantiGruppoProps) {
  const { palette } = useTheme();

  return (
    <Drawer
      anchor="bottom"
      open={Boolean(gruppo)}
      onClose={onChiudi}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88dvh" } } }}
    >
      <Box sx={{ p: 2, maxWidth: 640, mx: "auto", width: "100%" }}>
        <Typography
          variant="h6"
          gutterBottom
        >
          {gruppo?.nome ?? ""}
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1, mb: 1.5 }}>
          {(gruppo?.membri ?? [])
            .filter((membro) => membro.prodotto)
            .map((membro, indice) => {
              const prodotto = membro.prodotto as ProdottoVendibile;
              return (
                <TesseraProdotto
                  key={prodotto.prodottoId}
                  nome={prodotto.nome}
                  dettaglio={`${formatCurrency(prodotto.prezzo)} €`}
                  colore={coloreProdotto(prodotto.categoria, indice, palette.mode, prodotto.colore)}
                  onClick={() => {
                    onTocca(prodotto);
                    onChiudi();
                  }}
                />
              );
            })}
        </Box>

        <Button
          fullWidth
          onClick={onChiudi}
          sx={{ minHeight: 44 }}
        >
          Chiudi
        </Button>
      </Box>
    </Drawer>
  );
}

export default VariantiGruppo;
