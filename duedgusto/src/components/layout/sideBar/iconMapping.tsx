import {
  LayoutDashboard,
  Users,
  Wrench,
  List,
  Settings,
  ShoppingCart,
  HandCoins,
  ConciergeBell,
  Layers,
  CalendarRange,
  CalendarDays,
  Pencil,
  Warehouse,
  UserRound,
  Receipt,
  Truck,
  ClipboardList,
  CalendarCheck,
  FilePenLine,
  FileEdit,
  PackageSearch,
  UserCog,
  FileText,
  Menu,
  Shield,
  BookOpen,
  BookText,
  Globe,
  Images,
  ShoppingBag,
  Store,
  Star,
  House,
  UtensilsCrossed,
  Martini,
  Armchair,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export const iconMapping: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Wrench,
  List,
  Settings,
  ShoppingCart,
  // ⚠️ `HandCoins` esiste per «Vendita», ed è entrata nella mappa invece di riusare una chiave
  //    libera perché nessuna delle libere reggeva il **primo livello**: `List` è la stessa pila di
  //    righe di `Menu`, `CalendarDays` sarebbe il terzo calendario a schermo aprendo «Cassa»,
  //    `UserCog` la seconda sagoma di persona accanto a `Users`, e `Wrench`/`FileText` dicono
  //    «manutenzione» e «documenti» sulla voce che si apre cento volte al giorno.
  //    🔴 Non è `ShoppingCart`: quella è «Cassa», da anni, e a cassetto chiuso le due sarebbero
  //    lo stesso bottone — la regola già imposta a `Settings` qui sotto.
  HandCoins,
  // ⚠️ `ConciergeBell` per «Ordini», sorella di «Vendita» al primo livello. La scelta è di
  //    **forma** prima che di nome: i candidati naturali erano tutti pile di righe o fogli —
  //    `ListChecks` accanto a `List` (Lista fornitori), `ReceiptText` accanto a `Receipt` (Lista
  //    fatture), `NotepadText` accanto a `FileText`. `iconeDelSeed` confronta i *nomi* e non se
  //    ne accorgerebbe, ma a cassetto chiuso `NestedList` mette `opacity: 0` sulle etichette e
  //    l'icona **è** la voce: due pile di righe lì sono lo stesso bottone.
  //    🔴 Il campanello da bancone non somiglia a nulla di ciò che è già in mappa, ed è anche il
  //    gesto giusto — è la comanda che aspetta di essere servita.
  ConciergeBell,
  // ⚠️ `Layers` per «Gruppi prodotti»: strati sovrapposti, che è letteralmente ciò che un gruppo
  //    è — un livello sopra i prodotti. 🔴 Non `Boxes` né `Blocks`: sarebbero il secondo pacco
  //    accanto a `PackageSearch` (Prodotti), e le due voci stanno nello stesso cassetto, una
  //    sotto l'altra.
  Layers,
  CalendarRange,
  CalendarDays,
  Pencil,
  Warehouse,
  UserRound,
  Receipt,
  Truck,
  ClipboardList,
  CalendarCheck,
  FilePenLine,
  FileEdit,
  PackageSearch,
  UserCog,
  FileText,
  Menu,
  Shield,
  BookOpen,
  BookText,
  Globe,
  Images,
  ShoppingBag,
  // ⚠️ Non si riusa `Settings`: è già la sezione Impostazioni della cassa, e nella barra di
  // navigazione le due voci sarebbero indistinguibili — proprio le due che non vanno confuse.
  Store,
  // 🔴 Un'icona che manca qui non dà errore: la voce di menu compare **senza icona**, e la
  //    cosa si nota solo guardando la barra. Il seed la nomina come stringa, quindi le due
  //    liste vanno tenute allineate a mano.
  //    ⚠️ Non è più «il prezzo di avere le voci a database»: `__tests__/iconeDelSeed.test.tsx`
  //    legge TUTTI i sorgenti di `backend/SeedData/` e pretende che ogni nome di icona esista
  //    qui. Quel silenzio è diventato rumore, e il prezzo si è smesso di pagarlo.
  Star,
  // ── Le cinque pagine del sito vetrina ──────────────────────────────────────────────────
  // 🔴 Cinque icone DISTINTE fra loro e distinte da quelle già usate nel ramo Sito: due voci
  //    con la stessa icona nella navigazione sono indistinguibili, ed è la stessa regola già
  //    imposta a `Store` qui sopra.
  // ⚠️ `Menu` è già nella mappa ma è l'**hamburger** di lucide, non un listino: riusarlo per la
  //    pagina «Menu» del sito darebbe alla voce l'icona di un menu di navigazione, che è
  //    precisamente l'altra cosa che quella parola significa in questo gestionale.
  House,
  UtensilsCrossed,
  Martini,
  Armchair,
  MapPin,
};
