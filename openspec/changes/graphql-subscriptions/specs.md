# GraphQL Subscriptions — Specification

## Purpose

Define the real-time communication capabilities added to DuedGusto via GraphQL Subscriptions over WebSocket. This spec covers the WebSocket transport infrastructure (backend and frontend), three domain-specific subscriptions for cassa operations, JWT authentication on the WebSocket handshake, and automatic reconnection with token refresh.

---

## 1. WebSocket Transport Infrastructure

### Requirement: WebSocket Endpoint

The backend MUST accept WebSocket upgrade requests on the existing `/graphql` endpoint alongside HTTP requests. The server MUST support the `graphql-transport-ws` sub-protocol as defined by the `graphql-ws` library specification.

#### Scenario: Successful WebSocket connection

- GIVEN the backend is running and the client has a valid JWT
- WHEN the client initiates a WebSocket upgrade to `wss://{host}:4000/graphql` with sub-protocol `graphql-transport-ws`
- THEN the server MUST accept the upgrade
- AND the server MUST respond with `connection_ack` after receiving `connection_init`

#### Scenario: Rejected connection with unsupported sub-protocol

- GIVEN the backend is running
- WHEN the client initiates a WebSocket upgrade with sub-protocol `graphql-ws` (legacy) or no sub-protocol
- THEN the server MUST reject the connection with an appropriate close code

#### Scenario: Connection without connection_init within timeout

- GIVEN a WebSocket connection has been established at the transport level
- WHEN the client does NOT send `connection_init` within 10 seconds
- THEN the server MUST close the connection with close code 4408 (Connection initialisation timeout)

### Requirement: WebSocket Middleware Configuration

The backend MUST register the WebSocket middleware in the ASP.NET Core pipeline BEFORE the GraphQL middleware. The middleware MUST allow WebSocket connections from all origins currently permitted by the CORS policy.

#### Scenario: Middleware ordering

- GIVEN the ASP.NET Core application is starting
- WHEN the middleware pipeline is built
- THEN `UseWebSockets()` MUST be registered before `UseGraphQL()`

---

## 2. Authentication

### Requirement: JWT Validation on WebSocket Handshake

The backend MUST validate the JWT token provided in the `connection_init` payload before accepting the subscription connection. The token MUST be extracted from `connectionParams.Authorization` (format: `Bearer {token}`).

#### Scenario: Valid JWT in connection params

- GIVEN a client opens a WebSocket connection
- WHEN the client sends `connection_init` with `{ "Authorization": "Bearer {valid-jwt}" }`
- THEN the server MUST validate the JWT using the same validation parameters as HTTP requests
- AND the server MUST respond with `connection_ack`
- AND the authenticated user context MUST be available to subscription resolvers

#### Scenario: Missing JWT in connection params

- GIVEN a client opens a WebSocket connection
- WHEN the client sends `connection_init` without an `Authorization` field
- THEN the server MUST close the connection with close code 4401 (Unauthorized)

#### Scenario: Expired JWT in connection params

- GIVEN a client opens a WebSocket connection
- WHEN the client sends `connection_init` with an expired JWT
- THEN the server MUST close the connection with close code 4401 (Unauthorized)

#### Scenario: Invalid/malformed JWT in connection params

- GIVEN a client opens a WebSocket connection
- WHEN the client sends `connection_init` with a malformed or tampered JWT
- THEN the server MUST close the connection with close code 4401 (Unauthorized)

### Requirement: Frontend JWT Transmission

The frontend MUST pass the current JWT token in the `connectionParams` during the WebSocket `connection_init` phase. The token MUST be read from the same source used for HTTP requests (Zustand auth store).

#### Scenario: Token included on connection

- GIVEN the user is authenticated and has a valid JWT in the auth store
- WHEN the Apollo Client establishes a WebSocket connection
- THEN the `connectionParams` MUST include `{ "Authorization": "Bearer {current-jwt}" }`

---

## 3. Frontend Link Configuration

### Requirement: Split Link for HTTP and WebSocket

The Apollo Client MUST use a split link that routes operations based on their type: subscriptions MUST be sent over the WebSocket link (`GraphQLWsLink`), while queries and mutations MUST continue to use the existing HTTP link.

#### Scenario: Subscription routed to WebSocket

- GIVEN the Apollo Client is configured with the split link
- WHEN a `subscription` operation is executed
- THEN the operation MUST be sent through the `GraphQLWsLink` (WebSocket)

#### Scenario: Query routed to HTTP

- GIVEN the Apollo Client is configured with the split link
- WHEN a `query` operation is executed
- THEN the operation MUST be sent through the existing HTTP link

#### Scenario: Mutation routed to HTTP

- GIVEN the Apollo Client is configured with the split link
- WHEN a `mutation` operation is executed
- THEN the operation MUST be sent through the existing HTTP link

### Requirement: WebSocket URL from Runtime Config

The frontend MUST read the WebSocket endpoint URL from `public/config.json`. The config SHOULD include a `wsUrl` field (e.g., `wss://{ip}:4000/graphql`). If `wsUrl` is not present, the frontend MUST derive it from the existing `graphqlUrl` by replacing the `https://` scheme with `wss://`.

#### Scenario: Explicit wsUrl in config.json

- GIVEN `config.json` contains `{ "wsUrl": "wss://192.168.1.10:4000/graphql" }`
- WHEN the Apollo Client initializes the WebSocket link
- THEN it MUST use `wss://192.168.1.10:4000/graphql` as the endpoint

#### Scenario: Fallback from graphqlUrl

- GIVEN `config.json` does NOT contain a `wsUrl` field
- AND `config.json` contains `{ "graphqlUrl": "https://192.168.1.10:4000/graphql" }`
- WHEN the Apollo Client initializes the WebSocket link
- THEN it MUST derive and use `wss://192.168.1.10:4000/graphql` as the endpoint

---

## 4. Auto-Reconnect and Token Refresh

### Requirement: Automatic Reconnection

The frontend WebSocket client MUST automatically reconnect when the connection is lost (network drop, server restart, token expiry). Reconnection MUST use exponential backoff.

#### Scenario: Network disconnection and recovery

- GIVEN the WebSocket connection is active
- WHEN the network connection drops
- THEN the client MUST attempt to reconnect automatically
- AND the reconnection attempts MUST use exponential backoff (starting from 1 second, capped at 30 seconds)

#### Scenario: Server-initiated disconnect due to expired token

- GIVEN the WebSocket connection is active
- WHEN the server closes the connection with close code 4401 (Unauthorized)
- THEN the client MUST refresh the JWT via the existing `/api/auth/refreshtoken` endpoint
- AND the client MUST reconnect with the new token in `connectionParams`

#### Scenario: Reconnection with refreshed token

- GIVEN the client has detected a 4401 close code
- WHEN the token refresh succeeds
- THEN the client MUST establish a new WebSocket connection with the refreshed JWT
- AND all active subscriptions MUST be automatically re-subscribed

#### Scenario: Token refresh failure during reconnect

- GIVEN the client has detected a 4401 close code
- WHEN the token refresh fails (e.g., refresh token also expired)
- THEN the client MUST stop reconnection attempts
- AND the client MUST trigger the existing logout/session-expired flow

---

## 5. GraphQL Schema — Subscription Type

### Requirement: Subscription Root Type

The GraphQL schema MUST expose a `Subscription` root type alongside the existing `Query` and `Mutation` root types.

```graphql
type Subscription {
  onRegistroCassaUpdated(registroCassaId: Int): RegistroCassaUpdatedPayload!
  onVenditaCreated(registroCassaId: Int): VenditaCreatedPayload!
  onChiusuraCassaCompleted(registroCassaId: Int): ChiusuraCassaCompletedPayload!
}
```

#### Scenario: Schema introspection includes Subscription type

- GIVEN the GraphQL schema is loaded
- WHEN a client sends an introspection query
- THEN the schema MUST include a `subscriptionType` with name `Subscription`
- AND the `Subscription` type MUST include all three subscription fields

---

## 6. Subscription: onRegistroCassaUpdated

### Requirement: Notify on Registro Cassa Changes

The system MUST publish an event to the `onRegistroCassaUpdated` subscription whenever a registro cassa record is modified through a GraphQL mutation (e.g., update of totals, stato, note).

```graphql
type RegistroCassaUpdatedPayload {
  registroCassaId: Int!
  registroCassa: RegistroCassa!
  updatedBy: String!
  updatedAt: DateTime!
}
```

#### Scenario: Registro cassa updated by operator

- GIVEN client A is subscribed to `onRegistroCassaUpdated`
- AND client B is an authenticated operator
- WHEN client B executes a mutation that modifies a registro cassa
- THEN client A MUST receive a `RegistroCassaUpdatedPayload` with the updated registro cassa data
- AND the `updatedBy` field MUST contain the username of client B
- AND the `updatedAt` field MUST contain the server-side timestamp of the update

#### Scenario: Filtered by registroCassaId

- GIVEN client A is subscribed to `onRegistroCassaUpdated(registroCassaId: 5)`
- WHEN a mutation updates registro cassa with ID 5
- THEN client A MUST receive the event
- WHEN a mutation updates registro cassa with ID 10
- THEN client A MUST NOT receive the event

#### Scenario: Unfiltered subscription receives all updates

- GIVEN client A is subscribed to `onRegistroCassaUpdated` (no `registroCassaId` argument)
- WHEN a mutation updates any registro cassa
- THEN client A MUST receive the event for every update

#### Scenario: No event published for read-only operations

- GIVEN client A is subscribed to `onRegistroCassaUpdated`
- WHEN any client executes a query (read) on registro cassa
- THEN client A MUST NOT receive any event

---

## 7. Subscription: onVenditaCreated

### Requirement: Notify on New Vendita

The system MUST publish an event to the `onVenditaCreated` subscription whenever a new vendita (sale) is created through a GraphQL mutation.

```graphql
type VenditaCreatedPayload {
  venditaId: Int!
  vendita: Vendita!
  registroCassaId: Int!
  createdBy: String!
  createdAt: DateTime!
}
```

#### Scenario: New vendita created

- GIVEN client A is subscribed to `onVenditaCreated`
- AND client B is an authenticated operator
- WHEN client B executes a mutation that creates a new vendita
- THEN client A MUST receive a `VenditaCreatedPayload` containing the full vendita data
- AND the `registroCassaId` MUST reference the registro cassa the vendita belongs to

#### Scenario: Filtered by registroCassaId

- GIVEN client A is subscribed to `onVenditaCreated(registroCassaId: 3)`
- WHEN a new vendita is created for registro cassa ID 3
- THEN client A MUST receive the event
- WHEN a new vendita is created for registro cassa ID 7
- THEN client A MUST NOT receive the event

#### Scenario: Multiple subscribers receive the same event

- GIVEN client A and client B are both subscribed to `onVenditaCreated`
- WHEN client C creates a new vendita
- THEN both client A and client B MUST receive the event independently

---

## 8. Subscription: onChiusuraCassaCompleted

### Requirement: Notify on Chiusura Cassa Completion

The system MUST publish an event to the `onChiusuraCassaCompleted` subscription whenever a chiusura cassa (cash register closing) operation completes through a GraphQL mutation.

```graphql
type ChiusuraCassaCompletedPayload {
  chiusuraCassaId: Int!
  registroCassaId: Int!
  totaleChiusura: Decimal!
  completedBy: String!
  completedAt: DateTime!
}
```

#### Scenario: Chiusura cassa completed

- GIVEN client A is subscribed to `onChiusuraCassaCompleted`
- AND client B is an authenticated operator
- WHEN client B executes a mutation that completes a chiusura cassa
- THEN client A MUST receive a `ChiusuraCassaCompletedPayload`
- AND the `totaleChiusura` MUST contain the final total of the closing
- AND the `completedBy` MUST contain the username of client B

#### Scenario: Filtered by registroCassaId

- GIVEN client A is subscribed to `onChiusuraCassaCompleted(registroCassaId: 2)`
- WHEN a chiusura cassa completes for registro cassa ID 2
- THEN client A MUST receive the event
- WHEN a chiusura cassa completes for registro cassa ID 8
- THEN client A MUST NOT receive the event

#### Scenario: Chiusura event contains accurate totals

- GIVEN client A is subscribed to `onChiusuraCassaCompleted`
- WHEN a chiusura cassa completes with a calculated total of 1523.45
- THEN the `totaleChiusura` in the payload MUST be `1523.45`

---

## 9. Event Bus (Internal)

### Requirement: In-Process Event Publishing

The backend MUST provide an in-process event bus service that mutation resolvers use to publish events. Subscription resolvers MUST subscribe to this event bus to receive events. The event bus MUST support multiple concurrent subscribers for the same event type.

#### Scenario: Event published from mutation reaches subscription

- GIVEN a subscription resolver is listening on the event bus for `RegistroCassaUpdated` events
- WHEN a mutation resolver publishes a `RegistroCassaUpdated` event to the event bus
- THEN the subscription resolver MUST receive the event
- AND the event data MUST match what the mutation published

#### Scenario: No subscribers — event is discarded

- GIVEN no subscription resolvers are currently listening for `VenditaCreated` events
- WHEN a mutation publishes a `VenditaCreated` event
- THEN the event MUST be discarded without error
- AND the mutation MUST complete successfully

#### Scenario: Multiple subscribers receive independent copies

- GIVEN three subscription resolvers are listening for `ChiusuraCassaCompleted` events
- WHEN a mutation publishes one `ChiusuraCassaCompleted` event
- THEN all three subscribers MUST receive the event

---

## 10. Connection Lifecycle

### Requirement: Graceful Cleanup on Disconnect

The backend MUST clean up subscription resources when a client disconnects (WebSocket close, network drop, or server-side timeout). The server SHOULD dispose of the subscription's `IDisposable` when the connection ends.

#### Scenario: Client disconnects gracefully

- GIVEN client A has one active subscription
- WHEN client A closes the WebSocket connection normally (close code 1000)
- THEN the server MUST dispose of client A's subscription
- AND server memory for client A's subscription MUST be freed

#### Scenario: Client disconnects abruptly

- GIVEN client A has one active subscription
- WHEN the network drops and the server detects the broken connection
- THEN the server MUST dispose of client A's subscription within a reasonable timeout
- AND no orphaned subscription resources SHALL remain

### Requirement: Frontend Cleanup on Unmount

The frontend MUST unsubscribe from active GraphQL subscriptions when the subscribing React component unmounts. This MUST be handled via the standard Apollo `useSubscription` hook cleanup or explicit `subscription.unsubscribe()`.

#### Scenario: Component unmount triggers unsubscribe

- GIVEN a React component is subscribed to `onRegistroCassaUpdated` via `useSubscription`
- WHEN the component unmounts (e.g., user navigates away)
- THEN the subscription MUST be terminated on the client
- AND a `complete` message SHOULD be sent to the server for that subscription
