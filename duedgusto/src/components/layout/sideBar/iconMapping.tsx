import {
  LayoutDashboard,
  Users,
  Wrench,
  List,
  Settings,
  ShoppingCart,
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
