# Sistema di Routing Dinamico

Questo documento spiega come funziona il sistema di routing completamente dinamico implementato nell'applicazione.

## Come Funziona

Il sistema elimina la necessità di mantenere manualmente un file `routesMapping.tsx` e genera tutte le route automaticamente dai dati dei menu nel database.

### Componenti Principali

1. **`dynamicComponentLoader.tsx`** - Utility che carica dinamicamente i componenti React basandosi sul percorso del file
2. **`ProtectedRoutes.tsx`** - Componente aggiornato che usa il loader dinamico per generare le route

### Flusso di Funzionamento

```
Database (Menu) → GraphQL Query → User Store → ProtectedRoutes → Dynamic Component Loader → Rendered Component
```

1. L'utente effettua il login
2. Il sistema carica i menu associati al ruolo dell'utente
3. Per ogni menu con un `path` e `filePath`:
   - Il `path` diventa la route (es. `/gestionale/users-list`)
   - Il `filePath` viene usato per caricare il componente (es. `users/UserList.tsx`)
4. Il componente viene caricato dinamicamente usando Vite's `import.meta.glob`

## Configurazione Database

Per far funzionare il routing dinamico, ogni record nella tabella `Menu` deve avere:

### Campi Obbligatori

- **`menuId`** - ID univoco del menu
- **`title`** - Titolo visualizzato nella sidebar
- **`path`** - Percorso completo della route (es. `/gestionale/users-list`)
- **`filePath`** - Percorso relativo del componente React da caricare
- **`icon`** - Icona Material-UI da visualizzare
- **`isVisible`** - Booleano per mostrare/nascondere il menu nella sidebar
- **`parentMenuId`** - ID del menu padre (null per menu di primo livello)

### Esempi di Configurazione

#### Menu di Lista

```sql
INSERT INTO Menu (title, path, filePath, icon, isVisible, viewName, parentMenuId)
VALUES (
  'Lista Utenti',
  '/gestionale/users-list',
  'users/UserList.tsx',
  'People',
  true,
  'UserList',
  NULL
);
```

#### Menu di Dettaglio

```sql
INSERT INTO Menu (title, path, filePath, icon, isVisible, viewName, parentMenuId)
VALUES (
  'Dettagli Utente',
  '/gestionale/users-details',
  'users/UserDetails.tsx',
  'Person',
  false,  -- Nascosto dalla sidebar, accessibile solo via navigazione
  'UserDetails',
  NULL
);
```

#### Menu Gerarchico

```sql
-- Menu padre
INSERT INTO Menu (menuId, title, path, filePath, icon, isVisible, viewName, parentMenuId)
VALUES (
  100,
  'Amministrazione',
  NULL,  -- I menu padre non hanno path
  NULL,  -- I menu padre non hanno componente
  'Settings',
  true,
  NULL,
  NULL
);

-- Menu figlio
INSERT INTO Menu (title, path, filePath, icon, isVisible, viewName, parentMenuId)
VALUES (
  'Gestione Ruoli',
  '/gestionale/roles-list',
  'roles/RoleList.tsx',
  'Security',
  true,
  'RoleList',
  100  -- ID del menu padre
);
```

## Formato del Campo `filePath`

Il campo `filePath` può essere specificato in diversi formati (tutti vengono normalizzati automaticamente):

### Formati Supportati

1. **Relativo a `components/pages/`** (consigliato):
   ```
   users/UserList.tsx
   roles/RoleDetails.tsx
   menu/MenuList.tsx
   ```

2. **Con prefisso `../components/pages/`**:
   ```
   ../components/pages/users/UserList.tsx
   ```

3. **Con prefisso `components/pages/`**:
   ```
   components/pages/users/UserList.tsx
   ```

**Nota**: Il formato consigliato è il primo (relativo) per maggiore leggibilità nel database.

## Struttura Directory Componenti

I componenti devono trovarsi in `src/components/pages/` con questa struttura:

```
src/components/pages/
├── users/
│   ├── UserList.tsx
│   └── UserDetails.tsx
├── roles/
│   ├── RoleList.tsx
│   └── RoleDetails.tsx
├── menu/
│   ├── MenuList.tsx
│   └── MenuDetails.tsx
├── settings/
│   └── SettingsDetails.tsx
└── HomePage.tsx
```

## Aggiungere Nuove Pagine

Per aggiungere una nuova pagina all'applicazione:

1. **Crea il componente** in `src/components/pages/[area]/[ComponentName].tsx`
   ```tsx
   // src/components/pages/customers/CustomerList.tsx
   function CustomerList() {
     // ... implementazione
   }
   export default CustomerList;
   ```

2. **Aggiungi il record nel database**
   ```sql
   INSERT INTO Menu (title, path, filePath, icon, isVisible, viewName)
   VALUES (
     'Lista Clienti',
     '/gestionale/customers-list',
     'customers/CustomerList.tsx',
     'Business',
     true,
     'CustomerList'
   );
   ```

3. **Assegna il menu al ruolo appropriato**
   ```sql
   INSERT INTO RoleMenus (roleId, menuId)
   VALUES (1, [menuId_appena_inserito]);
   ```

4. **Ricarica l'applicazione** - Il nuovo menu apparirà automaticamente!

## Vantaggi del Sistema

✅ **Nessuna modifica al codice** per aggiungere nuove route
✅ **Configurazione centralizzata** nel database
✅ **Permessi granulari** per ruolo
✅ **Struttura gerarchica** con menu padre-figlio
✅ **Lazy loading automatico** per performance ottimali
✅ **Type-safe** con TypeScript
✅ **Hot reload** in sviluppo
✅ **Cache intelligente** per evitare ricaricamenti duplicati

## Gestione Errori

Se un componente non viene trovato, viene mostrato un messaggio di errore che include:
- Il percorso specificato nel database
- Il percorso normalizzato
- L'elenco dei componenti disponibili

Questo aiuta a identificare rapidamente errori di configurazione nel database.

## Debug

Per vedere tutti i componenti disponibili, puoi usare la funzione helper:

```typescript
import { getAvailableComponents } from './routes/dynamicComponentLoader';

console.log(getAvailableComponents());
```

## Migration da routesMapping.tsx

Il vecchio file `routesMapping.tsx` può essere mantenuto solo per il componente `Fallback`:

```typescript
// routesMapping.tsx (versione minima)
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";

export const Fallback = () => {
  return (
    <Backdrop open={true} sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
};
```

Tutto il resto viene gestito dinamicamente!

## Query GraphQL Necessaria

Il fragment GraphQL deve includere il campo `filePath`:

```graphql
fragment MenuFragment on Menu {
  menuId
  title
  path
  filePath  # ← Campo necessario per il routing dinamico
  icon
  isVisible
  viewName
  parentMenuId
}
```

## Troubleshooting

### Problema: "Componente non trovato"

**Causa**: Il `filePath` nel database non corrisponde a un file esistente

**Soluzione**:
1. Verifica che il file esista in `src/components/pages/`
2. Controlla che il percorso nel database sia corretto
3. Assicurati che il componente esporti un default export

### Problema: Route non appare nella sidebar

**Causa**: Il campo `isVisible` è `false` o l'utente non ha permessi

**Soluzione**:
1. Verifica che `isVisible = true` nel database
2. Controlla che il menu sia assegnato al ruolo dell'utente nella tabella `RoleMenus`
3. Verifica che l'utente abbia fatto logout/login dopo le modifiche

### Problema: Errore "Cannot find module"

**Causa**: Il componente non ha un default export

**Soluzione**:
```typescript
// ❌ Non funziona
export function MyComponent() { ... }

// ✅ Funziona
function MyComponent() { ... }
export default MyComponent;
```

## Performance

Il sistema usa:
- **Lazy loading** - I componenti vengono caricati solo quando necessario
- **Caching** - I componenti già caricati non vengono ricaricati
- **Code splitting automatico** - Vite divide automaticamente il bundle per route

Questo garantisce tempi di caricamento ottimali anche con molte route.
