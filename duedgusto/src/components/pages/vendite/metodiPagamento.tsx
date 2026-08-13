import CreditCardIcon from "@mui/icons-material/CreditCard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PaymentsIcon from "@mui/icons-material/Payments";
import { SvgIconComponent } from "@mui/icons-material";

export interface DescrizioneMetodo {
  valore: MetodoPagamentoVendita;
  etichetta: string;
  /** Che cosa succede al registro. Sta scritto sotto il pulsante: sono soldi, non preferenze. */
  effetto: string;
  icona: SvgIconComponent;
  /** Chiave del tema MUI, non un esadecimale: i tre colori devono reggere chiaro e scuro. */
  colore: "primary" | "success" | "warning";
}

/**
 * I tre pulsanti che compaiono dopo aver scelto il prodotto, **nell'ordine in cui si usano**:
 * l'elettronico è il più frequente dietro al bancone e sta per primo, sotto il pollice.
 *
 * ⚠️ L'ordine non è alfabetico e non va «sistemato»: è ergonomia, non catalogazione.
 */
export const METODI_PAGAMENTO: DescrizioneMetodo[] = [
  {
    valore: "ELETTRONICO",
    etichetta: "Elettronico",
    effetto: "Entra negli incassi elettronici",
    icona: CreditCardIcon,
    colore: "primary",
  },
  {
    valore: "CONTANTE_TRACCIATO",
    etichetta: "Contante tracciato",
    effetto: "Entra nel contante dichiarato",
    icona: ReceiptLongIcon,
    colore: "success",
  },
  {
    valore: "CONTANTE_NON_TRACCIATO",
    etichetta: "Contante non tracciato",
    // 🔴 Non è un buco ed è giusto dirlo all'operatore: quei soldi sono già contati dentro
    //    Chiusura − Apertura, e battere qui serve a registrare COSA è stato venduto, non dove
    //    sono finiti i soldi. Un'etichetta che promettesse un effetto sarebbe una bugia.
    effetto: "Nessun campo cambia: è già nel cassetto",
    icona: PaymentsIcon,
    colore: "warning",
  },
];

export function etichettaMetodo(metodo: MetodoPagamentoVendita): string {
  return METODI_PAGAMENTO.find((m) => m.valore === metodo)?.etichetta ?? metodo;
}
