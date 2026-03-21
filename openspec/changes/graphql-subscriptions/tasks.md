# Tasks: GraphQL Subscriptions

## Phase 1: Backend Infrastructure

- [x] 1.1 Verificare che `System.Reactive` sia disponibile come dipendenza transitiva di `GraphQL` v8.4.1 nel progetto `backend/backend.csproj`. Se non presente, aggiungere `<PackageReference Include="System.Reactive" />` esplicitamente ed eseguire `dotnet restore`
- [x] 1.2 Aggiungere `app.UseWebSockets()` nel pipeline middleware di `backend/Program.cs`, posizionandolo PRIMA della chiamata `UseGraphQL()` esistente
- [x] 1.3 Registrare il servizio `IEventBus` come singleton in `backend/Program.cs`: `builder.Services.AddSingleton<IEventBus, EventBus>()`
- [x] 1.4 Registrare `IWebSocketAuthenticationService` come transient in `backend/Program.cs`: `builder.Services.AddTransient<IWebSocketAuthenticationService, WebSocketAuthenticationService>()`

## Phase 2: Backend Event Bus

- [x] 2.1 Creare `backend/Services/Events/IEventBus.cs` con l'interfaccia `IEventBus` contenente i metodi `Publish<T>(T eventData)` e `IObservable<T> Subscribe<T>()`
- [x] 2.2 Creare `backend/Services/Events/EventBus.cs` con l'implementazione singleton basata su `Dictionary<Type, object>` di `Subject<T>`, thread-safe con lock, che implementa anche `IDisposable` per il cleanup dei Subject

## Phase 3: Backend Event Models e GraphQL Types

- [x] 3.1 Creare `backend/GraphQL/Subscriptions/Types/RegistroCassaUpdatedEvent.cs` — modello POCO con proprieta: `RegistroCassaId`, `Data`, `Stato`, `TotaleVendite`, `TotaleApertura`, `TotaleChiusura`, `Azione`
- [x] 3.2 Creare `backend/GraphQL/Subscriptions/Types/RegistroCassaUpdatedEventType.cs` — `ObjectGraphType<RegistroCassaUpdatedEvent>` con tutti i campi mappati (IntGraphType, DateTimeGraphType, StringGraphType, DecimalGraphType)
- [x] 3.3 Creare `backend/GraphQL/Subscriptions/Types/VenditaCreatedEvent.cs` — modello POCO con proprieta: `VenditaId`, `RegistroCassaId`, `NomeProdotto`, `Quantita`, `PrezzoTotale`, `DataOra`
- [x] 3.4 Creare `backend/GraphQL/Subscriptions/Types/VenditaCreatedEventType.cs` — `ObjectGraphType<VenditaCreatedEvent>` con tutti i campi mappati
- [x] 3.5 Creare `backend/GraphQL/Subscriptions/Types/ChiusuraCassaCompletedEvent.cs` — modello POCO con proprieta: `RegistroCassaId`, `Data`, `TotaleChiusura`, `Differenza`
- [x] 3.6 Creare `backend/GraphQL/Subscriptions/Types/ChiusuraCassaCompletedEventType.cs` — `ObjectGraphType<ChiusuraCassaCompletedEvent>` con tutti i campi mappati

## Phase 4: Backend Subscription Root Type e Schema

- [ ] 4.1 Creare `backend/GraphQL/Subscriptions/GraphQLSubscriptions.cs` — `ObjectGraphType` con `this.Authorize()`, tre `FieldType` con `StreamResolver` (da `eventBus.Subscribe<T>()`) e `Resolver` per ciascuna subscription: `onRegistroCassaUpdated`, `onVenditaCreated`, `onChiusuraCassaCompleted`
- [ ] 4.2 Modificare `backend/GraphQL/GraphQLSchema.cs` — aggiungere `Subscription = provider.GetRequiredService<GraphQLSubscriptions>()` nel costruttore, con il relativo `using duedgusto.GraphQL.Subscriptions`

## Phase 5: Backend WebSocket Authentication

- [ ] 5.1 Verificare la firma esatta di `JwtHelper.ValidateToken()` in `backend/Services/Jwt/JwtHelper.cs` — determinare se accetta una stringa token e restituisce un `ClaimsPrincipal` (o se serve un adattamento)
- [ ] 5.2 Creare `backend/Services/WebSocket/WebSocketAuthenticationService.cs` — implementazione di `IWebSocketAuthenticationService` che estrae il token da `connectionParams.authToken` (campo `JsonElement`), lo valida con `JwtHelper`, e popola `connection.HttpContext.User` con il `ClaimsPrincipal` risultante

## Phase 6: Backend Integration — Pubblicazione Eventi dalle Mutations

- [x] 6.1 Modificare `backend/GraphQL/GestioneCassa/GestioneCassaMutations.cs` — iniettare `IEventBus` via `GraphQLService.GetService<IEventBus>()`, dopo `SaveChangesAsync()` in `mutateRegistroCassa` pubblicare un `RegistroCassaUpdatedEvent` con i dati aggiornati
- [x] 6.2 Modificare `backend/GraphQL/GestioneCassa/GestioneCassaMutations.cs` — nel metodo di chiusura registro cassa (se presente come mutation separata), pubblicare un `ChiusuraCassaCompletedEvent` dopo il completamento della chiusura
- [x] 6.3 Modificare `backend/GraphQL/Vendite/VenditeMutations.cs` — iniettare `IEventBus` via `GraphQLService.GetService<IEventBus>()`, dopo `SaveChangesAsync()` in `CreaVenditaAsync` pubblicare un `VenditaCreatedEvent` con i dati della nuova vendita
- [x] 6.4 Eseguire `dotnet build` in `backend/` e verificare che la compilazione passi senza errori

## Phase 7: Frontend Dependencies e Configurazione Apollo

- [ ] 7.1 Installare la dipendenza `graphql-ws` nel frontend: eseguire `npm install graphql-ws` nella directory `duedgusto/`
- [ ] 7.2 Verificare che `config.json` (`duedgusto/public/config.json`) contenga il campo `GRAPHQL_WEBSOCKET` (o equivalente `wsUrl`). Se mancante, aggiungere la logica di fallback che deriva l'URL WS da `graphqlUrl` sostituendo `https://` con `wss://`
- [ ] 7.3 Modificare `duedgusto/src/graphql/configureClient.tsx` — aggiungere gli import per `GraphQLWsLink` (da `@apollo/client/link/subscriptions`), `createClient` (da `graphql-ws`), `split` (da `@apollo/client`), `getMainDefinition` (da `@apollo/client/utilities`)
- [ ] 7.4 Modificare `duedgusto/src/graphql/configureClient.tsx` — creare il `wsLink` con `GraphQLWsLink` + `createClient()`, configurando: URL dal config runtime, `connectionParams` async che legge il JWT dallo store auth e fa refresh se scaduto, `shouldRetry: () => true`, `retryAttempts: Infinity`
- [ ] 7.5 Modificare `duedgusto/src/graphql/configureClient.tsx` — implementare il backoff esponenziale in `retryWait`: delay = min(1000 * 2^retries, 30000) ms
- [ ] 7.6 Modificare `duedgusto/src/graphql/configureClient.tsx` — creare lo `splitLink` con `split()` che instradi le operazioni `subscription` su `wsLink` e tutto il resto sulla catena HTTP esistente (`from([errorLink, authLink, httpLink])`)
- [ ] 7.7 Modificare `duedgusto/src/graphql/configureClient.tsx` — sostituire il link dell'`ApolloClient` con `splitLink` al posto della catena diretta

## Phase 8: Frontend Subscription Hooks

- [ ] 8.1 Creare `duedgusto/src/graphql/subscriptions/useRegistroCassaSubscription.tsx` — definire la query `ON_REGISTRO_CASSA_UPDATED` (gql), l'interfaccia TypeScript `RegistroCassaUpdatedData`, e l'hook `useRegistroCassaSubscription` basato su `useSubscription<RegistroCassaUpdatedData>`
- [ ] 8.2 Creare `duedgusto/src/graphql/subscriptions/useVenditaCreatedSubscription.tsx` — definire la query `ON_VENDITA_CREATED` (gql), l'interfaccia TypeScript `VenditaCreatedData`, e l'hook `useVenditaCreatedSubscription` basato su `useSubscription<VenditaCreatedData>`
- [ ] 8.3 Creare `duedgusto/src/graphql/subscriptions/useChiusuraCassaSubscription.tsx` — definire la query `ON_CHIUSURA_CASSA_COMPLETED` (gql), l'interfaccia TypeScript `ChiusuraCassaCompletedData`, e l'hook `useChiusuraCassaSubscription` basato su `useSubscription<ChiusuraCassaCompletedData>`

## Phase 9: Frontend Component Integration

- [x] 9.1 Integrare `useRegistroCassaSubscription` nei componenti della pagina RegistrazioneCassa (`duedgusto/src/components/pages/registrazioneCassa/`) — quando arriva un evento, aggiornare la cache Apollo o ri-fetchare i dati del registro cassa corrente
- [x] 9.2 Integrare `useVenditaCreatedSubscription` nei componenti della pagina Vendite — quando arriva un evento di nuova vendita per il registro cassa corrente, aggiornare la lista vendite visualizzata
- [x] 9.3 Integrare `useChiusuraCassaSubscription` nei componenti della pagina RegistrazioneCassa — quando arriva un evento di chiusura completata, aggiornare lo stato del registro e mostrare feedback visivo
- [x] 9.4 Eseguire `npm run ts:check` e `npm run lint` nella directory `duedgusto/` e verificare che passino senza errori

## Phase 10: Testing Manuale

- [ ] 10.1 Test connessione WebSocket: avviare backend e frontend, verificare che la connessione WebSocket si stabilisca correttamente su `wss://{ip}:4000/graphql` (controllare nella console browser Network > WS)
- [ ] 10.2 Test autenticazione WS: verificare che un client non autenticato (senza JWT) venga rifiutato con close code 4401; verificare che un client autenticato riceva `connection_ack`
- [ ] 10.3 Test subscription RegistroCassa: aprire 2 tab browser, in tab A navigare alla pagina cassa, in tab B modificare un registro cassa → verificare che tab A riceva l'aggiornamento in tempo reale
- [ ] 10.4 Test subscription Vendita: aprire 2 tab, in tab A osservare la lista vendite, in tab B creare una nuova vendita → verificare che tab A mostri la nuova vendita senza refresh
- [ ] 10.5 Test subscription ChiusuraCassa: in tab A osservare il registro cassa, in tab B completare una chiusura cassa → verificare che tab A riceva la notifica di chiusura completata
- [ ] 10.6 Test riconnessione: con una subscription attiva, interrompere la connessione di rete (es. disabilitare WiFi), ripristinare → verificare che il client si riconnetta automaticamente con backoff esponenziale e le subscription riprendano
- [ ] 10.7 Test introspection: verificare via GraphQL Playground/Altair che lo schema includa il tipo `Subscription` con i tre campi
