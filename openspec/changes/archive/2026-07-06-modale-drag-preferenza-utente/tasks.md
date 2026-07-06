# Tasks: Preferenza per-utente drag modale (free/elastic)

Change: `modale-drag-preferenza-utente`
Moduli: backend .NET 8 (GraphQL.NET + EF Core MySQL) + frontend React 19 TS.
Ordine consigliato: Fase 1 (entity + config) -> Fase 2 (migration DB, isolata) -> Fase 3 (backend GraphQL) -> Fase 4 (contratto TS/GraphQL condiviso) -> Fase 5 (frontend UI/consumo) -> Fase 6 (testing) -> Fase 7 (verifica build/lint).

---

## Phase 1: Infrastructure — Entity + EF Core config

- [x] 1.1 In `backend/Models/Utente.cs` aggiungere la property `public string PreferenzaDragModale { get; set; } = "free";` (non-nullable, default CLR `"free"`) all'entita' `Utente`.
- [x] 1.2 In `backend/DataAccess/AppDbContext.cs` (blocco config `Utente`, righe ~58-73) aggiungere `entity.Property(x => x.PreferenzaDragModale).IsRequired().HasMaxLength(20).HasDefaultValue("free");` cosi' la colonna diventa `varchar(20)` NOT NULL con default schema `"free"`.
- [x] 1.3 (Opzionale/cosmetico) In `backend/SeedData/SeedTestUser.cs` valorizzare esplicitamente `PreferenzaDragModale = "free"` sull'utente di seed (il default CLR + `HasDefaultValue` gia' coprono; assegnare solo se si vuole rendere il seed autodocumentante).

## Phase 2: Database migration (isolata dal codice applicativo)

- [x] 2.1 Generare la migration: `cd backend && dotnet ef migrations add AddPreferenzaDragModaleToUtente` (esegue dopo la Fase 1: la property e la config devono gia' esistere).
- [x] 2.2 Verificare che il file `backend/Migrations/<ts>_AddPreferenzaDragModaleToUtente.cs` contenga in `Up` `AddColumn<string>(name:"PreferenzaDragModale", table:"Utenti", type:"varchar(20)", nullable:false, defaultValue:"free")` e in `Down` `DropColumn(name:"PreferenzaDragModale", table:"Utenti")` (allineato al pattern `20260322141031_AddAliquotaIvaToFornitore.cs`). Correggere manualmente se EF omette `defaultValue`/`type`.
- [x] 2.3 Verificare che `backend/Migrations/AppDbContextModelSnapshot.cs` sia stato rigenerato con la nuova property `PreferenzaDragModale` sul modello `Utente`.
- [ ] 2.4 Applicare e validare la migration su un DB con tabella `Utenti` gia' popolata (avvio backend con `Database.MigrateAsync()` o `dotnet ef database update`): confermare che gli utenti esistenti ereditano `"free"` senza backfill e senza errori su colonna non-nullable.

## Phase 3: Backend — Schema GraphQL + mutation

- [x] 3.1 In `backend/GraphQL/Authentication/Types/UtenteType.cs` esporre il campo output: `Field(x => x.PreferenzaDragModale, typeof(StringGraphType));` (o equivalente allo stile del file), cosi' `Utente.preferenzaDragModale: String!`.
- [x] 3.2 In `backend/GraphQL/Authentication/Types/UtenteInputType.cs` accettare il campo input opzionale: `Field<StringGraphType>("preferenzaDragModale");` (nullable: se omesso in `mutateUtente`, il backend applica fallback/valore corrente).
- [x] 3.3 In `backend/GraphQL/Authentication/AuthMutations.cs` (`mutateUtente`) aggiungere l'helper whitelist+fallback: `static readonly HashSet<string> DragModesAmmessi = new() { "free", "elastic" };` e un metodo `string ParseDragMode(Dictionary<string, object> arg)` che restituisce il valore solo se `ContainsKey("preferenzaDragModale")` e appartiene alla whitelist, altrimenti `"free"`.
- [x] 3.4 In `backend/GraphQL/Authentication/AuthMutations.cs`, ramo **update** (~righe 150-169): assegnare `existingUser.PreferenzaDragModale = ParseDragMode(userArg);` SOLO se la chiave e' presente, per non sovrascrivere il valore corrente quando `preferenzaDragModale` e' omesso (spec: "Update senza chiave preferenza non altera il valore"). Se assente, lasciare invariato il valore esistente.
- [x] 3.5 In `backend/GraphQL/Authentication/AuthMutations.cs`, ramo **create** (~righe 171-196, initializer di `newUser`): impostare `PreferenzaDragModale = ParseDragMode(userArg),` cosi' il create applica il valore fornito oppure il default `"free"` (spec: "Create senza preferenza applica il default" / "Create con preferenza esplicita").

## Phase 4: Contratto condiviso TS/GraphQL (frontend)

- [x] 4.1 In `duedgusto/src/@types/Utente.d.ts` definire il tipo ambient `type DragModePreference = "free" | "elastic";` e aggiungere il campo `preferenzaDragModale: DragModePreference` al tipo dominio `Utente`.
- [x] 4.2 In `duedgusto/src/graphql/utente/fragment.tsx` aggiungere `preferenzaDragModale` a `UtenteFragment` (propaga automaticamente a `getUtenteCorrente`, `getUtentePerId` e `mutationSubmitUtente` che condividono il fragment).
- [x] 4.3 In `duedgusto/src/graphql/utente/mutations.tsx` aggiungere il campo `preferenzaDragModale: DragModePreference` (o opzionale, coerente col resto dell'interfaccia) all'interfaccia TS `UtenteInput`.

## Phase 5: Frontend — Hook, ProfilePage e AppDialog

- [x] 5.1 Creare l'hook `duedgusto/src/components/common/dialog/useDragModePreference.tsx`: `function useDragModePreference(): DragModePreference { return useStore((state) => state.utente?.preferenzaDragModale) ?? "free"; }` (centralizza lettura store + fallback `"free"`; opzionale: normalizzare valori fuori whitelist a `"free"` in lettura, spec "Robustezza in lettura").
- [x] 5.2 In `duedgusto/src/components/common/dialog/AppDialog.tsx` aliasare `export type DialogDragMode = DragModePreference;`, calcolare `const effectiveDragMode = dragMode ?? useDragModePreference();` (prop esplicito vince) e usare `effectiveDragMode` al posto dell'attuale default `DEFAULT_DRAG_MODE`. Rimuovere/deprecare `DEFAULT_DRAG_MODE` come sorgente del default (mantenere il valore `"free"` solo come fallback interno se serve).
- [x] 5.3 In `duedgusto/src/components/pages/profile/ProfilePage.tsx` aggiungere `preferenzaDragModale` allo schema di validazione Zod come `z.enum(["free", "elastic"])` e ai valori iniziali del form Formik letti dallo store (`utente.preferenzaDragModale ?? "free"`).
- [x] 5.4 In `duedgusto/src/components/pages/profile/ProfilePage.tsx` aggiungere una sezione "Preferenze" con un `RadioGroup` MUI (collegato manualmente a Formik) con opzioni `free` = "Resta dove la lasci" ed `elastic` = "Torna al centro"; selezione iniziale = preferenza corrente.
- [x] 5.5 In `duedgusto/src/components/pages/profile/ProfilePage.tsx` includere `preferenzaDragModale` nelle variables di `mutationSubmitUtente` al submit e, in `onCompleted`, aggiornare lo store via `receiveUtente(updated)` (spec: "Cambio e salvataggio della preferenza").

## Phase 6: Testing

- [x] 6.1 Test unit hook: creare `duedgusto/src/components/common/dialog/__tests__/useDragModePreference.test.tsx` che verifica: (a) con `utente.preferenzaDragModale = "elastic"` ritorna `"elastic"`; (b) con `utente = null` ritorna `"free"` (fallback). Mock di `useStore`. (Aggiunti anche i casi `"free"` esplicito e normalizzazione valore fuori whitelist → `"free"`.)
- [x] 6.2 Estendere `duedgusto/src/components/pages/profile/__tests__/ProfilePage.test.tsx`: il RadioGroup riflette la preferenza corrente dallo store (scenario "Il selettore riflette la preferenza corrente").
- [x] 6.3 Estendere `ProfilePage.test.tsx`: cambiando il selettore a `"elastic"` e salvando, `mockMutate` viene chiamato con `preferenzaDragModale = "elastic"` e `receiveUtente` aggiornato (scenario "Cambio e salvataggio della preferenza").
- [x] 6.4 Estendere `ProfilePage.test.tsx`: salvataggio di altri campi (es. `nome`) senza toccare il selettore preserva `preferenzaDragModale` nelle variables (scenario "Salvataggio di altri campi preserva la preferenza").
- [x] 6.5 Aggiungere ai test dei componenti modali consumatori di `AppDialog` un `vi.mock` di `useDragModePreference` per evitare rotture da nuovo accesso allo store (aggiunto ai due consumatori con test esistenti: `MonthlyClosureDetails.test.tsx`, `PagamentoFornitoreDialog.test.tsx`; gli altri consumatori non hanno test). L'override esplicito del prop `dragMode` è coperto a livello di implementazione (`effectiveDragMode = dragMode ?? preferenza`).
- [x] 6.6 Creare integration test backend in `backend/DuedGusto.Tests/Integration/GraphQL/UserPreferencesTests.cs`: **create** con `preferenzaDragModale = "elastic"` persiste il valore nel DB (scenario "Create con preferenza esplicita").
- [x] 6.7 Integration test backend: **create** senza `preferenzaDragModale` persiste `"free"` (scenario "Create senza preferenza applica il default").
- [x] 6.8 Integration test backend: **update** con `preferenzaDragModale = "elastic"` cambia il valore; update su altri campi senza la chiave lascia invariato il valore (scenari "Update con preferenza esplicita" / "Update senza chiave preferenza non altera il valore").
- [x] 6.9 Integration test backend: valore fuori whitelist (`"spring"`), stringa vuota `""` e casing diverso (`"FREE"`) normalizzano a `"free"` invocando il vero `AuthMutations.ParseDragMode` via reflection + test update con `"spring"` che persiste `"free"` (scenari "Valore fuori whitelist" / "Valore vuoto").
- [x] 6.10 Integration test backend: lettura della preferenza persistita per un utente seed con valore `"elastic"` + round-trip salvataggio/rilettura (scenario "Lettura della preferenza via utenteCorrente" + "Round-trip").

## Phase 7: Verifica build/lint (CI gate)

- [x] 7.1 Backend: `cd backend && dotnet build` OK (0 Warning, 0 Error).
- [x] 7.2 Backend: `cd backend && dotnet test` — 267/267 verdi (12 nuovi in `UserPreferencesTests`).
- [x] 7.3 Frontend: `cd duedgusto && npm run ts:check` OK.
- [x] 7.4 Frontend: `cd duedgusto && npm run lint` OK.
- [x] 7.5 Frontend: `cd duedgusto && npm run test` — 633/633 verdi (84 file, inclusi hook + ProfilePage estesi + consumatori).
