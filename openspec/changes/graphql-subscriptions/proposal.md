# Proposal: GraphQL Subscriptions

## Intent

Abilitare la comunicazione real-time tra backend e frontend tramite GraphQL Subscriptions su WebSocket. Attualmente tutte le operazioni sono request/response via HTTP. Quando un operatore modifica il registro cassa o effettua una vendita, gli altri client non ricevono aggiornamenti fino al prossimo polling/navigazione. Le subscriptions risolvono questo problema fornendo push updates istantanei.

## Scope

### In Scope
- Configurazione del trasporto WebSocket nel backend (GraphQL.NET + ASP.NET Core)
- Creazione del tipo `SubscriptionType` nello schema GraphQL con subscription iniziali
- Subscription: `onRegistroCassaUpdated` — notifica quando un registro cassa viene modificato
- Subscription: `onVenditaCreated` — notifica quando viene creata una nuova vendita
- Subscription: `onChiusuraCassaCompleted` — notifica quando una chiusura cassa viene completata
- Installazione e configurazione di `graphql-ws` nel frontend
- Configurazione dello split link Apollo Client (HTTP per query/mutation, WebSocket per subscription)
- Autenticazione WebSocket tramite token JWT nel connection params
- Integrazione con l'endpoint WebSocket già predisposto in `config.json` (`wss://...`)

### Out of Scope
- Subscription per TUTTE le entità (solo i casi d'uso principali della cassa)
- Notifiche push browser / service worker
- Presenza utenti in real-time (chi è online)
- Migrazione a HotChocolate o altro framework GraphQL
- Implementazione di subscription per moduli Fornitori/Settings/ChiusureMensili (fase futura)

## Approach

Utilizzare il supporto nativo di GraphQL.NET per le subscriptions con il trasporto WebSocket già incluso nel pacchetto `GraphQL.Server.Transports.AspNetCore` v8.2.0. Il pattern prevede:

1. **Backend**: Aggiungere WebSocket middleware, creare `GraphQLSubscriptions` come terzo tipo root dello schema, implementare un servizio `IObservable<T>` event-based per pubblicare eventi dai mutation resolver
2. **Frontend**: Installare `graphql-ws`, creare un `GraphQLWsLink`, configurare uno `split` link che instradi subscription su WS e query/mutation su HTTP
3. **Autenticazione**: Passare il JWT come `connectionParams` durante l'handshake WebSocket; validarlo nel backend prima di accettare la connessione

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/Program.cs` | Modified | Aggiunta WebSocket middleware e configurazione |
| `backend/GraphQL/GraphQLSchema.cs` | Modified | Registrazione del tipo Subscription |
| `backend/GraphQL/Subscriptions/` | New | Nuovo modulo con `GraphQLSubscriptions.cs` e tipi subscription |
| `backend/Services/Events/` | New | Servizio event bus per pubblicare eventi dalle mutation |
| `backend/GraphQL/GestioneCassa/GestioneCassaMutations.cs` | Modified | Pubblicazione eventi dopo operazioni cassa |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Modified | Pubblicazione eventi dopo creazione vendita |
| `duedgusto/package.json` | Modified | Aggiunta dipendenza `graphql-ws` |
| `duedgusto/src/graphql/configureClient.tsx` | Modified | Split link WS/HTTP, autenticazione WS |
| `duedgusto/src/graphql/subscriptions/` | New | Hook e query per le subscription |
| `duedgusto/src/components/pages/registrazioneCassa/` | Modified | Integrazione subscription per aggiornamenti real-time |

## Risks

| Rischio | Probabilit&agrave; | Mitigazione |
|---------|------------|-------------|
| Connessioni WebSocket non chiuse correttamente causano memory leak | Media | Implementare cleanup nel frontend (useEffect cleanup), timeout lato server |
| JWT scaduto durante connessione WS attiva | Media | Implementare reconnect automatico con token refreshato in `graphql-ws` connectionParams |
| CORS/firewall bloccano upgrade WebSocket | Bassa | Il backend gi&agrave; accetta CORS; documentare configurazione proxy/reverse-proxy |
| Carico server con molte connessioni WS simultanee | Bassa | Per il volume attuale (POS singolo/pochi terminali) non &egrave; un problema; scalabilit&agrave; &egrave; out of scope |
| GraphQL.NET subscription API meno documentata | Media | Seguire esempi ufficiali del repo GraphQL.NET; prototipare con subscription minimale |

## Rollback Plan

1. Il tipo `Subscription` nello schema pu&ograve; essere rimosso senza impatto su query/mutation esistenti
2. Il frontend split link continua a funzionare in modalit&agrave; solo-HTTP se il WS non &egrave; disponibile (fallback gi&agrave; gestito da Apollo)
3. Nessuna migrazione database richiesta — rollback &egrave; puramente codice
4. Rimuovere il pacchetto `graphql-ws` dal frontend e ripristinare il link chain originale

## Dependencies

- `GraphQL.Server.Transports.AspNetCore` v8.2.0 (gi&agrave; installato, supporta WebSocket)
- `graphql-ws` (npm, da installare nel frontend — sostituto moderno di `subscriptions-transport-ws`)
- Nessuna migrazione database necessaria

## Success Criteria

- [ ] Il backend accetta connessioni WebSocket su `/graphql`
- [ ] Lo schema GraphQL espone il tipo `Subscription` con almeno `onRegistroCassaUpdated`
- [ ] Il frontend si connette via WebSocket e riceve eventi in real-time
- [ ] Quando un operatore modifica il registro cassa, gli altri client ricevono l'aggiornamento automaticamente
- [ ] Il JWT viene validato durante l'handshake WebSocket
- [ ] La connessione si riconnette automaticamente dopo disconnessione/refresh token
- [ ] `dotnet build` passa senza errori
- [ ] `npm run ts:check` e `npm run lint` passano senza errori
