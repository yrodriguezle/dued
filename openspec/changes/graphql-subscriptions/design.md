# Design: GraphQL Subscriptions

## Technical Approach

Estendere lo schema GraphQL.NET esistente con un terzo tipo root `Subscription`, sfruttando il supporto WebSocket nativo del pacchetto `GraphQL.Server.Transports.AspNetCore` v8.2.0 gia installato. Sul frontend, installare `graphql-ws` e configurare uno split link Apollo Client che instradi le subscription su WebSocket e tutto il resto su HTTP. Un servizio event bus singleton basato su `IObservable<T>` (pattern Reactive) collega le mutation ai subscriber.

## Architecture Decisions

### Decision: Event Bus con IObservable<T> tramite Subject<T>

**Choice**: Servizio singleton `EventBus` che usa `System.Reactive.Subjects.Subject<T>` per ogni tipo di evento, esposto come `IObservable<T>`.

**Alternatives considered**:
1. `System.Threading.Channels` — piu performante per scenari high-throughput ma manca il pattern multicast necessario per subscription GraphQL (ogni subscriber deve ricevere ogni evento)
2. MediatR/MassTransit — overhead eccessivo per un POS con pochi terminali; aggiunge dipendenze esterne non necessarie
3. Custom `EventHandler`/delegates — non compatibile con il pattern `IObservable<T>` richiesto da GraphQL.NET per le subscription

**Rationale**: GraphQL.NET richiede che i resolver subscription restituiscano `IObservable<T>`. `Subject<T>` da System.Reactive e il modo piu diretto per creare un `IObservable<T>` che supporti multicast (ogni client connesso riceve gli eventi). Il volume previsto (pochi terminali POS) non richiede soluzioni piu complesse.

### Decision: Autenticazione WebSocket tramite connectionParams + middleware custom

**Choice**: Il client invia il JWT in `connectionParams.authToken` durante l'handshake. Un middleware nel pipeline WebSocket di GraphQL.NET estrae il token, lo valida con `JwtHelper`, e popola il `GraphQLUserContext` con il `ClaimsPrincipal`.

**Alternatives considered**:
1. Cookie-based auth per WS — i browser inviano automaticamente i cookie durante l'upgrade WS, ma il JWT e in localStorage (non cookie) nel progetto attuale; cambiare questo pattern romperebbe l'architettura auth esistente
2. Protocollo subprotocol custom — complessita non necessaria; `graphql-ws` supporta nativamente `connectionParams`

**Rationale**: L'architettura auth esistente conserva il JWT in localStorage e lo inietta nell'header Authorization via Apollo authLink. Per WebSocket non si possono inviare header custom, quindi `connectionParams` e il meccanismo standard. `GraphQL.Server.Transports.AspNetCore` supporta un `WebSocketAuthenticationService` dedicato a questo scopo.

### Decision: WebSocket sullo stesso endpoint `/graphql`

**Choice**: Usare lo stesso path `/graphql` per HTTP e WebSocket, gestito automaticamente da `UseGraphQL<GraphQLSchema>()` che gia supporta l'upgrade del protocollo.

**Alternatives considered**:
1. Endpoint separato `/graphql-ws` — aggiunge complessita nella configurazione senza benefici reali; GraphQL.NET gestisce gia entrambi i protocolli sullo stesso path

**Rationale**: Il pacchetto `GraphQL.Server.Transports.AspNetCore` v8.2.0 supporta nativamente WebSocket sullo stesso endpoint. Il `config.json` del frontend gia prevede `GRAPHQL_WEBSOCKET: "wss://localhost:4000/graphql"` sullo stesso path. Nessuna modifica necessaria alla configurazione degli URL.

### Decision: Nessun pacchetto NuGet aggiuntivo per il backend

**Choice**: Usare `System.Reactive` (gia incluso transitivamente con GraphQL.NET) e il supporto WebSocket gia presente in `GraphQL.Server.Transports.AspNetCore`.

**Alternatives considered**:
1. Installare un pacchetto subscription dedicato — non necessario; GraphQL.NET include tutto il necessario per subscription via WebSocket

**Rationale**: Il csproj mostra che `GraphQL` v8.4.1 e `GraphQL.Server.Transports.AspNetCore` v8.2.0 sono gia installati. Il supporto WebSocket e subscription e integrato. Sara necessario solo verificare che `System.Reactive` sia disponibile (dipendenza transitiva) e aggiungere il pacchetto esplicitamente se mancante.

### Decision: Split Link con riconnessione automatica nel frontend

**Choice**: Usare `split()` di Apollo Client per instradare le operazioni `subscription` su `GraphQLWsLink` (da `@apollo/client/link/subscriptions`) e il resto su `httpLink`. Configurare `graphql-ws` con `shouldRetry: () => true` e `connectionParams` che legge il token corrente ad ogni riconnessione.

**Alternatives considered**:
1. `subscriptions-transport-ws` — deprecato a favore di `graphql-ws`; non mantiene compatibilita con il protocollo `graphql-transport-ws` usato da GraphQL.NET v8

**Rationale**: `graphql-ws` e lo standard moderno, supporta il protocollo `graphql-transport-ws` che GraphQL.NET v8 implementa. Apollo Client fornisce `GraphQLWsLink` gia integrato. La funzione `split()` e il pattern documentato di Apollo per instradare subscription su WS.

## Data Flow

### Flusso Subscription: Mutation → EventBus → WebSocket → Client

```
Client A (mutation)                    Server                          Client B (subscriber)
       |                                 |                                    |
       |-- mutateRegistroCassa --------->|                                    |
       |                                 |-- GestioneCassaMutations           |
       |                                 |   salva su DB                      |
       |                                 |   eventBus.Publish(                |
       |                                 |     RegistroCassaUpdatedEvent)     |
       |                                 |                                    |
       |                                 |-- EventBus (Subject<T>)           |
       |                                 |   OnNext() → tutti i subscriber    |
       |                                 |                                    |
       |                                 |-- GraphQLSubscriptions             |
       |                                 |   IObservable<T> emette evento --->|
       |                                 |                                    |
       |<-- risposta mutation ----------|                                    |
       |                                 |               push via WebSocket ->|
       |                                 |                                    |-- aggiorna UI
```

### Flusso Autenticazione WebSocket

```
Client                          Server (ASP.NET Core + GraphQL.NET)
  |                                 |
  |-- WS upgrade request ---------->|
  |   (wss://host/graphql)          |
  |                                 |-- UseWebSockets() middleware
  |                                 |-- UseGraphQL() accetta upgrade
  |                                 |
  |<-- WS connection aperta --------|
  |                                 |
  |-- connection_init ------------->|
  |   { authToken: "eyJhb..." }    |
  |                                 |-- WebSocketAuthenticationService
  |                                 |   valida JWT con JwtHelper
  |                                 |   popola GraphQLUserContext
  |                                 |
  |<-- connection_ack --------------|
  |                                 |
  |-- subscribe ------------------->|
  |   { query: "subscription..." }  |
  |                                 |-- Verifica .Authorize() sul campo
  |                                 |-- Registra subscriber su EventBus
  |                                 |
  |<-- next (evento) --------------|  (quando una mutation pubblica)
  |<-- next (evento) --------------|
  |                                 |
  |-- complete -------------------->|  (client si disconnette)
```

### Flusso Riconnessione con Token Refresh

```
Client (Apollo + graphql-ws)         Server
  |                                    |
  |<-- WS connection persa ------------|
  |                                    |
  |-- graphql-ws: retrying...          |
  |   connectionParams() chiamata      |
  |   → getAuthToken() dal localStorage|
  |                                    |
  |   se token scaduto:               |
  |   → executeTokenRefresh()          |
  |   → attendi nuovo token            |
  |   → connectionParams con nuovo JWT |
  |                                    |
  |-- WS reconnect con nuovo token --->|
  |-- connection_init ----------------->|
  |<-- connection_ack ------------------|
  |                                    |
  |   (graphql-ws ri-sottoscrive       |
  |    automaticamente le subscription |
  |    attive)                         |
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/Program.cs` | Modify | Aggiungere `app.UseWebSockets()` prima di `UseGraphQL()`, registrare `EventBus` come singleton e `WebSocketAuthenticationService` nei servizi |
| `backend/GraphQL/GraphQLSchema.cs` | Modify | Aggiungere `Subscription = provider.GetRequiredService<GraphQLSubscriptions>()` |
| `backend/GraphQL/Subscriptions/GraphQLSubscriptions.cs` | Create | Root subscription type con campi `onRegistroCassaUpdated`, `onVenditaCreated`, `onChiusuraCassaCompleted` |
| `backend/GraphQL/Subscriptions/Types/RegistroCassaUpdatedEvent.cs` | Create | Modello evento per aggiornamento registro cassa |
| `backend/GraphQL/Subscriptions/Types/RegistroCassaUpdatedEventType.cs` | Create | GraphQL ObjectGraphType per l'evento registro cassa |
| `backend/GraphQL/Subscriptions/Types/VenditaCreatedEvent.cs` | Create | Modello evento per nuova vendita |
| `backend/GraphQL/Subscriptions/Types/VenditaCreatedEventType.cs` | Create | GraphQL ObjectGraphType per l'evento vendita |
| `backend/GraphQL/Subscriptions/Types/ChiusuraCassaCompletedEvent.cs` | Create | Modello evento per chiusura cassa completata |
| `backend/GraphQL/Subscriptions/Types/ChiusuraCassaCompletedEventType.cs` | Create | GraphQL ObjectGraphType per l'evento chiusura cassa |
| `backend/Services/Events/EventBus.cs` | Create | Servizio singleton con `Subject<T>` per ogni tipo di evento, metodi `Publish<T>()` e `Subscribe<T>()` |
| `backend/Services/Events/IEventBus.cs` | Create | Interfaccia per il servizio event bus |
| `backend/Services/WebSocket/WebSocketAuthenticationService.cs` | Create | Implementazione di `IWebSocketAuthenticationService` che valida JWT da `connectionParams` |
| `backend/GraphQL/GestioneCassa/GestioneCassaMutations.cs` | Modify | Dopo `SaveChangesAsync()` in `mutateRegistroCassa` e `chiudiRegistroCassa`, pubblicare eventi sull'event bus |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Modify | Dopo `SaveChangesAsync()` in `CreaVenditaAsync`, pubblicare evento `VenditaCreatedEvent` |
| `duedgusto/package.json` | Modify | Aggiungere dipendenza `graphql-ws` |
| `duedgusto/src/graphql/configureClient.tsx` | Modify | Aggiungere `GraphQLWsLink`, `split()` link, `connectionParams` con JWT |
| `duedgusto/src/graphql/subscriptions/useRegistroCassaSubscription.tsx` | Create | Hook React per subscription `onRegistroCassaUpdated` |
| `duedgusto/src/graphql/subscriptions/useVenditaCreatedSubscription.tsx` | Create | Hook React per subscription `onVenditaCreated` |
| `duedgusto/src/graphql/subscriptions/useChiusuraCassaSubscription.tsx` | Create | Hook React per subscription `onChiusuraCassaCompleted` |

## Interfaces / Contracts

### Backend: Event Bus

```csharp
// backend/Services/Events/IEventBus.cs
namespace duedgusto.Services.Events;

public interface IEventBus
{
    void Publish<T>(T eventData);
    IObservable<T> Subscribe<T>();
}
```

```csharp
// backend/Services/Events/EventBus.cs
using System.Reactive.Subjects;

namespace duedgusto.Services.Events;

public class EventBus : IEventBus, IDisposable
{
    private readonly Dictionary<Type, object> _subjects = new();
    private readonly object _lock = new();

    public void Publish<T>(T eventData)
    {
        lock (_lock)
        {
            if (_subjects.TryGetValue(typeof(T), out var subject))
            {
                ((Subject<T>)subject).OnNext(eventData);
            }
        }
    }

    public IObservable<T> Subscribe<T>()
    {
        lock (_lock)
        {
            if (!_subjects.ContainsKey(typeof(T)))
            {
                _subjects[typeof(T)] = new Subject<T>();
            }
            return (Subject<T>)_subjects[typeof(T)];
        }
    }

    public void Dispose()
    {
        lock (_lock)
        {
            foreach (var subject in _subjects.Values)
            {
                ((IDisposable)subject).Dispose();
            }
            _subjects.Clear();
        }
    }
}
```

### Backend: Event Models

```csharp
// backend/GraphQL/Subscriptions/Types/RegistroCassaUpdatedEvent.cs
namespace duedgusto.GraphQL.Subscriptions.Types;

public class RegistroCassaUpdatedEvent
{
    public int RegistroCassaId { get; set; }
    public DateTime Data { get; set; }
    public string Stato { get; set; } = string.Empty;
    public decimal TotaleVendite { get; set; }
    public decimal TotaleApertura { get; set; }
    public decimal TotaleChiusura { get; set; }
    public string Azione { get; set; } = string.Empty; // "CREATED", "UPDATED", "DELETED"
}
```

```csharp
// backend/GraphQL/Subscriptions/Types/VenditaCreatedEvent.cs
namespace duedgusto.GraphQL.Subscriptions.Types;

public class VenditaCreatedEvent
{
    public int VenditaId { get; set; }
    public int RegistroCassaId { get; set; }
    public string NomeProdotto { get; set; } = string.Empty;
    public int Quantita { get; set; }
    public decimal PrezzoTotale { get; set; }
    public DateTime DataOra { get; set; }
}
```

```csharp
// backend/GraphQL/Subscriptions/Types/ChiusuraCassaCompletedEvent.cs
namespace duedgusto.GraphQL.Subscriptions.Types;

public class ChiusuraCassaCompletedEvent
{
    public int RegistroCassaId { get; set; }
    public DateTime Data { get; set; }
    public decimal TotaleChiusura { get; set; }
    public decimal Differenza { get; set; }
}
```

### Backend: Subscription Root Type

```csharp
// backend/GraphQL/Subscriptions/GraphQLSubscriptions.cs
using GraphQL;
using GraphQL.Resolvers;
using GraphQL.Types;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.Services.Events;

namespace duedgusto.GraphQL.Subscriptions;

public class GraphQLSubscriptions : ObjectGraphType
{
    public GraphQLSubscriptions(IEventBus eventBus)
    {
        this.Authorize();

        AddField(new FieldType
        {
            Name = "onRegistroCassaUpdated",
            Type = typeof(RegistroCassaUpdatedEventType),
            StreamResolver = new SourceStreamResolver<RegistroCassaUpdatedEvent>(
                _ => eventBus.Subscribe<RegistroCassaUpdatedEvent>()
            ),
            Resolver = new FuncFieldResolver<RegistroCassaUpdatedEvent>(
                context => context.Source as RegistroCassaUpdatedEvent
            )
        });

        AddField(new FieldType
        {
            Name = "onVenditaCreated",
            Type = typeof(VenditaCreatedEventType),
            StreamResolver = new SourceStreamResolver<VenditaCreatedEvent>(
                _ => eventBus.Subscribe<VenditaCreatedEvent>()
            ),
            Resolver = new FuncFieldResolver<VenditaCreatedEvent>(
                context => context.Source as VenditaCreatedEvent
            )
        });

        AddField(new FieldType
        {
            Name = "onChiusuraCassaCompleted",
            Type = typeof(ChiusuraCassaCompletedEventType),
            StreamResolver = new SourceStreamResolver<ChiusuraCassaCompletedEvent>(
                _ => eventBus.Subscribe<ChiusuraCassaCompletedEvent>()
            ),
            Resolver = new FuncFieldResolver<ChiusuraCassaCompletedEvent>(
                context => context.Source as ChiusuraCassaCompletedEvent
            )
        });
    }
}
```

### Backend: WebSocket Authentication

```csharp
// backend/Services/WebSocket/WebSocketAuthenticationService.cs
using System.Security.Claims;
using GraphQL.Server.Transports.AspNetCore.WebSockets;
using GraphQL.Transport;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;

namespace duedgusto.Services.WebSocket;

public class WebSocketAuthenticationService : IWebSocketAuthenticationService
{
    private readonly JwtHelper _jwtHelper;

    public WebSocketAuthenticationService(JwtHelper jwtHelper)
    {
        _jwtHelper = jwtHelper;
    }

    public Task AuthenticateAsync(
        IWebSocketConnection connection,
        string subProtocol,
        OperationMessage operationMessage)
    {
        var payload = operationMessage.Payload;
        if (payload is System.Text.Json.JsonElement jsonElement
            && jsonElement.TryGetProperty("authToken", out var tokenElement))
        {
            var token = tokenElement.GetString();
            if (!string.IsNullOrEmpty(token))
            {
                var principal = _jwtHelper.ValidateToken(token);
                if (principal != null)
                {
                    // Popola lo HttpContext.User per il GraphQLUserContext
                    connection.HttpContext.User = principal;
                }
            }
        }

        return Task.CompletedTask;
    }
}
```

### Backend: Modifiche a Program.cs

```csharp
// Registrazione servizi (da aggiungere nella sezione servizi)
builder.Services.AddSingleton<IEventBus, EventBus>();
builder.Services.AddTransient<IWebSocketAuthenticationService, WebSocketAuthenticationService>();

// Middleware pipeline (da aggiungere PRIMA di UseGraphQL)
app.UseWebSockets();
```

### Backend: Modifiche a GraphQLSchema.cs

```csharp
// backend/GraphQL/GraphQLSchema.cs
using GraphQL.Types;
using duedgusto.GraphQL.Subscriptions;

namespace duedgusto.GraphQL;

public class GraphQLSchema : Schema
{
    public GraphQLSchema(IServiceProvider provider) : base(provider)
    {
        Query = provider.GetRequiredService<GraphQLQueries>();
        Mutation = provider.GetRequiredService<GraphQLMutations>();
        Subscription = provider.GetRequiredService<GraphQLSubscriptions>();
    }
}
```

### Frontend: configureClient.tsx (modifiche)

```typescript
// Nuovi import da aggiungere
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { split } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";

// Creazione del WebSocket link (dentro configureClient())
const wsLink = new GraphQLWsLink(
  createClient({
    url: (window as Global).GRAPHQL_WEBSOCKET || "",
    connectionParams: async () => {
      const authToken = getAuthToken();
      if (!authToken?.token) return {};

      // Verifica se il token e scaduto e fai refresh se necessario
      const payload = decodeJwtPayload(authToken.token);
      const now = Math.floor(Date.now() / 1000);
      if (payload && typeof payload.exp === "number" && payload.exp < now) {
        const success = await executeTokenRefresh();
        if (success) {
          const refreshedToken = getAuthToken();
          return { authToken: refreshedToken?.token };
        }
      }

      return { authToken: authToken.token };
    },
    shouldRetry: () => true,
    retryAttempts: Infinity,
    retryWait: async (retries) => {
      // Backoff esponenziale: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, retries), 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    },
  })
);

// Split link: subscription su WS, tutto il resto su HTTP
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  from([errorLink, authLink, httpLink])
);

// Modifica ApolloClient: usare splitLink invece della catena diretta
apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({ /* ...invariato... */ }),
});
```

### Frontend: Hook Subscription

```typescript
// duedgusto/src/graphql/subscriptions/useRegistroCassaSubscription.tsx
import { gql, useSubscription } from "@apollo/client";

const ON_REGISTRO_CASSA_UPDATED = gql`
  subscription OnRegistroCassaUpdated {
    onRegistroCassaUpdated {
      registroCassaId
      data
      stato
      totaleVendite
      totaleApertura
      totaleChiusura
      azione
    }
  }
`;

interface RegistroCassaUpdatedData {
  onRegistroCassaUpdated: {
    registroCassaId: number;
    data: string;
    stato: string;
    totaleVendite: number;
    totaleApertura: number;
    totaleChiusura: number;
    azione: string;
  };
}

const useRegistroCassaSubscription = () => {
  return useSubscription<RegistroCassaUpdatedData>(ON_REGISTRO_CASSA_UPDATED);
};

export default useRegistroCassaSubscription;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Backend Build | Compilazione corretta con nuovi tipi | `dotnet build` — nessun errore |
| Backend Integration | EventBus pubblica e riceve eventi | Test manuale: invocare mutation e verificare che il subscriber riceva l'evento via GraphQL Playground/Altair |
| Frontend Build | TypeScript compila senza errori | `npm run ts:check` e `npm run lint` |
| Frontend Integration | WebSocket connection + split link | Test manuale: aprire 2 tab, modificare registro in una, verificare aggiornamento nell'altra |
| E2E | Flusso completo mutation → subscription | Test manuale multi-tab: creare vendita → verificare notifica real-time |
| Resilienza | Riconnessione dopo disconnessione WS | Test manuale: interrompere connessione di rete, ripristinare, verificare riconnessione automatica |

**Nota**: Il progetto non ha test unitari. La strategia di testing e interamente manuale, coerente con le convenzioni del codebase esistente.

## Migration / Rollout

Nessuna migrazione database richiesta. Gli eventi di subscription sono modelli in-memory, non entita EF Core. Nessuna tabella da creare o modificare.

**Rollout plan**:
1. Deploy backend con nuovi servizi (EventBus, WebSocket auth, GraphQLSubscriptions) — completamente backward-compatible perche query e mutation non cambiano
2. Deploy frontend con split link — il link `split()` instradi correttamente: se WebSocket non e disponibile, solo le subscription falliscono; query e mutation continuano a funzionare via HTTP
3. Nessun feature flag necessario — le subscription sono additive e non impattano funzionalita esistenti

**Rollback**: Rimuovere il tipo `Subscription` dallo schema e il `wsLink` dal frontend. Zero impatto su funzionalita esistenti.

## Open Questions

- [ ] Verificare che `System.Reactive` sia disponibile come dipendenza transitiva di GraphQL v8.4.1 — se non lo e, aggiungere `<PackageReference Include="System.Reactive" />` esplicitamente nel csproj
- [ ] Il metodo `JwtHelper.ValidateToken(string)` restituisce un `ClaimsPrincipal`? Verificare la firma esatta per usarla nel `WebSocketAuthenticationService` — potrebbe servire un adattamento per estrarre il principal dal token string
- [ ] Valutare se aggiungere un argomento `registroCassaId` alla subscription `onRegistroCassaUpdated` per filtrare lato server (utile se in futuro ci sono piu terminali che lavorano su registri diversi)
