---
name: react-best-practices
description: Pattern e buone pratiche React consolidate nel progetto DuedGusto. Usa questa skill quando crei nuove pagine, componenti, hook o form. Copre layout pagina, toolbar, gestione stato, form con Formik/Zod, scroll, metriche, dialog, navigazione e pattern anti-loop.
---

# React Best Practices — DuedGusto

Pattern concreti estratti dal codice del progetto. Ogni sezione include il pattern, il perche, e il codice di riferimento.

---

## 1. Layout Pagina: Flex Column + Scroll Singolo

**Problema**: doppio scrollbar (scroll della pagina + scroll del contenuto) quando il contenuto supera la viewport.

**Soluzione**: struttura flex column con altezza fissa, toolbar non scrollabile, contenuto con overflow auto.

```tsx
<Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
  {/* Toolbar: non scrolla mai */}
  <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
    <Toolbar variant="dense" disableGutters sx={{ minHeight: 48, height: 48 }}>
      {/* bottoni */}
    </Toolbar>
  </Box>

  {/* Contenuto: scroll singolo */}
  <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, px: 2, py: 2 }}>
    {/* tutto il contenuto qui */}
  </Box>
</Box>
```

**Perche `minHeight: 0`**: senza questo, il flex item non si riduce sotto il contenuto minimo e lo scroll non funziona.

**64px**: altezza della HeaderBar. Per pagine con toolbar Formik (41px), non serve sottrarla — la toolbar e dentro il flex column.

**Usato in**: MonthlyClosureDetails, CashRegisterMonthlyPage, SettingsDetails.

---

## 2. Toolbar Consistente

Tutte le pagine di dettaglio usano lo stesso pattern toolbar.

```tsx
<Toolbar variant="dense" disableGutters sx={{ minHeight: 48, height: 48, display: "flex", justifyContent: "space-between" }}>
  {/* Sinistra: azioni principali */}
  <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
    <FormikToolbarButton startIcon={<ArrowBackIcon />} onClick={handleBack}>
      Indietro
    </FormikToolbarButton>
    <FormikToolbarButton startIcon={<SaveIcon />} disabled={isMutating} onClick={handleSave}>
      Salva
    </FormikToolbarButton>
  </Box>

  {/* Destra: navigazione / azioni secondarie */}
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pr: 1 }}>
    {/* IconButton, Badge, etc. */}
  </Box>
</Toolbar>
```

**Regole**:
- `FormikToolbarButton` per tutti i bottoni azione (ha hover/active/disabled integrati)
- `alignItems: "stretch"` per altezza piena nella Box sinistra
- `IconButton` per azioni compatte a destra (stampa, notifiche, navigazione)

---

## 3. Riferimenti Stabili per Evitare Loop Infiniti

**Problema**: `useEffect` che dipende da un array restituito da un hook. Se l'hook fa `return data || []`, ogni render crea un nuovo `[]` e l'effect si riesegue all'infinito.

**Soluzione**: costante stabile + useMemo.

```tsx
// Nel hook di query (fuori dal componente)
const EMPTY_ARRAY: string[] = [];

export const useQueryData = ({ skip }: { skip?: boolean }) => {
  const { data, loading } = useQuery(QUERY, { skip });

  const items = useMemo(
    () => data?.items ?? EMPTY_ARRAY,
    [data?.items]
  );

  return { items, loading };
};
```

**Quando serve**:
- Fallback su array vuoto: `?? EMPTY_ARRAY` con `useMemo`, MAI `|| []` diretto nel return
- Oggetti derivati che finiscono nelle dipendenze di `useEffect`

---

## 4. Aggiornamento Stato Condizionale (Anti-Loop)

**Problema**: `useEffect` che chiama `setState(newArray)` — anche se i dati sono identici, React fa re-render perche il riferimento e nuovo.

**Soluzione**: functional updater con confronto prima di aggiornare.

```tsx
useEffect(() => {
  setItems((prev) => {
    const newDates = data.map((d) => dayjs(d).format("YYYY-MM-DD"));
    const prevDates = prev.map((e) => e.data);

    // Nessun cambiamento? Ritorna prev (stesso riferimento, nessun re-render)
    if (newDates.length === prevDates.length && newDates.every((d, i) => d === prevDates[i])) {
      return prev;
    }

    return newDates.map((d) => ({ data: d, motivo: "DEFAULT" }));
  });
}, [data]);
```

**Regola**: se un `useEffect` chiama `setState`, usa SEMPRE il functional updater `setState(prev => ...)` e confronta prima di restituire un nuovo valore.

---

## 5. Form: Conversione Tipo per Campi Numerici

**Problema**: `FormikTextField` con `type="number"` salva il valore come stringa. Lo schema Zod con `z.number()` fallisce con "Expected number, received string".

**Soluzione**: custom `onChange` che converte a numero.

```tsx
<FormikTextField
  name="vatRate"
  label="Aliquota IVA (%)"
  type="number"
  inputProps={{ step: "0.01", min: "0", max: "100" }}
  onChange={(_name, value, field, form) => {
    form.setFieldValue(field.name, value === "" ? 0 : Number(value));
  }}
  fullWidth
/>
```

**Regola**: ogni campo `type="number"` con validazione Zod `z.number()` DEVE avere questo `onChange`.

---

## 6. Select con MUI: MenuItem, Non Option

**Problema**: `FormikTextField` con prop `select` e figli `<option>` non funziona con il Select MUI non-nativo.

**Soluzione**: usare `<MenuItem>`.

```tsx
// CORRETTO
<FormikTextField name="timezone" label="Fuso Orario" select fullWidth>
  {timezones.map((tz) => (
    <MenuItem key={tz.value} value={tz.value}>{tz.label}</MenuItem>
  ))}
</FormikTextField>

// SBAGLIATO
<FormikTextField name="timezone" select SelectProps={{ native: false }}>
  {timezones.map((tz) => (
    <option key={tz.value} value={tz.value}>{tz.label}</option>
  ))}
</FormikTextField>
```

---

## 7. Metriche / KPI Strip

**Problema**: `Grid` con `md={2}` si allarga troppo su schermi grandi.

**Soluzione**: `display: flex` con `flexWrap: wrap` e `minWidth` per ogni box.

```tsx
<Paper variant="outlined" sx={{ p: 2 }}>
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="caption" color="text.secondary">Ricavo Netto</Typography>
      <Typography variant="h6" fontWeight="bold" color="primary.main">
        {`€ ${value.toFixed(2)}`}
      </Typography>
    </Box>
    <Box sx={{ minWidth: 110 }}>
      {/* altra metrica */}
    </Box>
  </Box>
</Paper>
```

**Perche non Grid**: Grid distribuisce proporzionalmente lo spazio. Con flex + minWidth, le metriche si raggruppano naturalmente e wrappano quando lo spazio non basta.

---

## 8. Dialog / Modale

Pattern per dialog gestiti con stato locale.

```tsx
const [dialogOpen, setDialogOpen] = useState(false);

// Trigger: Badge + IconButton nella toolbar
{hasItems && (
  <IconButton onClick={() => setDialogOpen(true)} size="small">
    <Badge badgeContent={count} color="error" invisible={count === 0}>
      <EventBusyIcon color={count > 0 ? "error" : "action"} />
    </Badge>
  </IconButton>
)}

// Dialog
<Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
  <DialogTitle>Titolo</DialogTitle>
  <DialogContent dividers>
    {/* contenuto */}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setDialogOpen(false)}>Chiudi</Button>
  </DialogActions>
</Dialog>
```

---

## 9. Auto-Azione al Mount (con Redirect)

Pattern per creare automaticamente una risorsa quando si entra in una pagina "nuova".

```tsx
const autoCreateInitiated = useRef(false);
const [autoCreateError, setAutoCreateError] = useState<string | null>(null);

useEffect(() => {
  if (isNewMode && !autoCreateInitiated.current) {
    autoCreateInitiated.current = true;
    createMutation({ variables: { ... } })
      .then((result) => {
        const newItem = result.data?.entity;
        if (newItem) {
          navigate(`/path/${newItem.id}`, { replace: true });
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "";
        // Se l'entita esiste gia, redirect a quella esistente
        const existingIdMatch = message.match(/ID:\s*(\d+)/);
        if (existingIdMatch) {
          navigate(`/path/${existingIdMatch[1]}`, { replace: true });
          return;
        }
        setAutoCreateError(message || "Errore nella creazione");
      });
  }
}, [isNewMode, createMutation, navigate]);
```

**Regole**:
- `useRef(false)` per impedire doppia esecuzione (StrictMode in dev chiama l'effect due volte)
- `navigate(..., { replace: true })` per non inquinare la history
- Gestire il caso "esiste gia" nel catch

---

## 10. Navigazione con useCallback

Tutti gli handler di navigazione devono essere wrappati in `useCallback`.

```tsx
const navigate = useNavigate();

const handleBack = useCallback(() => {
  navigate("/gestionale/cassa/details");
}, [navigate]);

const handlePrevMonth = useCallback(() => {
  setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
}, []);

const handleNextMonth = useCallback(() => {
  setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
}, []);
```

**Perche**: se passati come prop a un componente figlio (es. `CustomCalendar`), evitano re-render inutili.

---

## 11. Stati di Caricamento ed Errore

Pattern consistente per loading/error/empty.

```tsx
// Loading
if (loading) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
      <CircularProgress />
    </Box>
  );
}

// Errore
if (error) {
  return <Alert severity="error">Errore nel caricamento: {error.message}</Alert>;
}

// Non trovato
if (!entity) {
  return <Alert severity="warning">Elemento non trovato.</Alert>;
}
```

---

## 12. Computed Values con useMemo

Catena di `useMemo` per dati derivati. Ogni step dipende dal precedente.

```tsx
// Step 1: parsing dati grezzi
const parsedData = useMemo(() => {
  if (!rawJson) return [];
  try { return JSON.parse(rawJson) as Item[]; } catch { return []; }
}, [rawJson]);

// Step 2: set per lookup veloce
const dataSet = useMemo(
  () => new Set(parsedData.map((d) => d.key)),
  [parsedData]
);

// Step 3: filtraggio
const filteredItems = useMemo(
  () => allItems.filter((item) => !dataSet.has(item.key)),
  [allItems, dataSet]
);

// Step 4: flag derivati (senza useMemo — sono cheap)
const hasItems = filteredItems.length > 0;
```

**Regola**: `useMemo` per operazioni su array (parse, filter, map, sort). Derivazioni booleane semplici non servono memo.

---

## 13. Sezioni Form con Paper

Per form di impostazioni, raggruppare i campi in sezioni logiche.

```tsx
<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
  <Paper variant="outlined" sx={{ p: 2.5 }}>
    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
      Sezione Uno
    </Typography>
    <Grid container spacing={2}>
      {/* campi */}
    </Grid>
  </Paper>

  <Paper variant="outlined" sx={{ p: 2.5 }}>
    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
      Sezione Due
    </Typography>
    <Grid container spacing={2}>
      {/* campi */}
    </Grid>
  </Paper>
</Box>
```

**Regole**:
- `Paper variant="outlined"` (non elevation) per sezioni form — meno rumore visivo
- `Typography variant="subtitle1" fontWeight={600}` per titoli sezione
- `gap: 2.5` tra sezioni (20px)
- `maxWidth: 720` sul contenitore per evitare form troppo larghi su schermi grandi

---

## 14. Dark Mode: Colori con alpha()

Per colori di sfondo che funzionano in entrambi i temi.

```tsx
import { alpha, useTheme } from "@mui/material";

const theme = useTheme();
const isDark = theme.palette.mode === "dark";

// Sfondo con trasparenza
bgcolor: isDark
  ? alpha(theme.palette.primary.main, 0.08)
  : alpha(theme.palette.primary.main, 0.06)

// Hover
"&:hover": {
  bgcolor: alpha(theme.palette.primary.main, 0.12),
}
```

**Regola**: mai hardcodare colori esadecimali per sfondi. Usare `alpha()` su colori del tema per adattarsi automaticamente a chiaro/scuro.

---

## Checklist Nuova Pagina

1. Layout flex column con `height: calc(100vh - 64px)`
2. Toolbar 48px con `FormikToolbarButton`
3. Area contenuto con `flex: 1, overflow: auto, minHeight: 0`
4. `useEffect` per `setTitle()` della header bar
5. Gestione loading/error/not-found prima del return principale
6. `useCallback` su tutti gli handler di navigazione e azioni
7. `useMemo` per dati derivati da query
8. Tutti i label in italiano
9. Tutti i file `.tsx`
