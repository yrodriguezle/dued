# PRODUCT.md - Due d gusto Bar Management System

## 📋 Panoramica del Progetto

Sistema gestionale completo per il bar "Due d gusto", sviluppato con architettura client-server moderna per digitalizzare e ottimizzare tutte le operazioni commerciali quotidiane.

## 🎯 Obiettivi del Prodotto

Fornire una soluzione integrata per la gestione completa dell'attività del bar, con focus su:
- Gestione precisa della cassa e contante
- Tracciamento completo di acquisti e vendite
- Controllo inventario in tempo reale
- Reportistica e analisi delle performance commerciali

## 🏗️ Architettura Tecnica

### Client Application
**Stack Tecnologico:**
- **Framework**: React 18+ con TypeScript
- **Build Tool**: Vite
- **Data Fetching**: Apollo Client (GraphQL)
- **UI Framework**: Material-UI (MUI)
- **Data Grid**: AG-Grid
- **State Management**: Apollo Cache + React Context

**Caratteristiche:**
- Single Page Application (SPA)
- Interfaccia responsive e user-friendly
- Gestione real-time dei dati tramite GraphQL subscriptions
- Validazione client-side con TypeScript
- Componenti riutilizzabili con MUI

### Server Application
**Stack Tecnologico:**
- **Runtime**: .NET Core 8+
- **API Layer**: GraphQL.NET / HotChocolate
- **ORM**: Entity Framework Core
- **Database**: MySQL 8+
- **Authentication**: JWT-based auth

**Caratteristiche:**
- API GraphQL type-safe
- Validazione business logic server-side
- Transazioni ACID per operazioni critiche
- Backup automatico database
- Logging e monitoring

## 🎨 Moduli Funzionali

### 1. Gestione Cassa

**Funzionalità Principali:**
- **Apertura/Chiusura Cassa**
  - Registrazione fondi iniziali
  - Conteggio dettagliato per taglio di moneta/banconota
  - Calcolo automatico totale
  - Quadratura cassa a fine turno

- **Gestione Contante**
  - Input per quantità di ogni taglio:
    - Monete: 0.01€, 0.02€, 0.05€, 0.10€, 0.20€, 0.50€, 1€, 2€
    - Banconote: 5€, 10€, 20€, 50€, 100€, 200€, 500€
  - Calcolo automatico subtotali e totale
  - Storico movimenti cassa
  - Reportistica discordanze

- **Operazioni Cassa**
  - Registrazione incassi vendite
  - Gestione pagamenti (contante, carta, digitale)
  - Prelievi e versamenti
  - Note e causali per ogni movimento

### 2. Gestione Acquisti

**Funzionalità Principali:**
- **Anagrafica Fornitori**
  - Dati completi fornitori
  - Storico ordini
  - Condizioni commerciali

- **Ordini di Acquisto**
  - Creazione ordini
  - Gestione stati (in attesa, ricevuto, pagato)
  - Upload documenti (fatture, DDT)
  - Tracking spese per categoria

- **Ricezione Merce**
  - Verifica conformità ordine
  - Aggiornamento automatico inventario
  - Gestione lotti e scadenze
  - Note e segnalazioni

- **Controllo Costi**
  - Analisi costi per fornitore
  - Trend di spesa
  - Confronto prezzi
  - Budget vs spese effettive

### 3. Gestione Vendite

**Funzionalità Principali:**
- **Catalogo Prodotti**
  - Anagrafica completa prodotti
  - Categorie (caffetteria, pasticceria, bevande, food, etc.)
  - Prezzi di vendita
  - Marginalità per prodotto

- **Punto Vendita (POS)**
  - Interfaccia rapida per vendite
  - Calcolo automatico totale
  - Gestione sconti e promozioni
  - Stampa scontrini/ricevute
  - Split bill

- **Gestione Ordini**
  - Registrazione vendite
  - Metodi di pagamento multipli
  - Annullamenti e resi
  - Storico clienti (opzionale)

- **Analisi Vendite**
  - Vendite per prodotto
  - Vendite per categoria
  - Vendite per fascia oraria
  - Prodotti più venduti
  - Trend giornalieri/settimanali/mensili

### 4. Gestione Inventario

**Funzionalità Principali:**
- **Movimenti Magazzino**
  - Carico/scarico automatico da acquisti/vendite
  - Rettifiche manuali
  - Causali movimenti
  - Tracciabilità completa

- **Giacenze**
  - Visualizzazione stock attuale
  - Livelli di riordino
  - Alert scorte minime
  - Prodotti in scadenza

- **Inventario Fisico**
  - Conteggio periodico
  - Confronto con giacenze teoriche
  - Gestione differenze inventariali
  - Reportistica discordanze

## 📊 Dashboard e Reportistica

### Dashboard Principale
- Situazione cassa attuale
- Vendite giornaliere
- Top prodotti del giorno
- Alert e notifiche
- KPI principali

### Report Disponibili
- **Finanziari**: Incassi, costi, margini, utili
- **Operativi**: Vendite per turno, per operatore
- **Analitici**: Trend vendite, stagionalità, ABC analysis
- **Inventario**: Giacenze, rotazione, obsolescenza
- **Fiscali**: Corrispettivi, IVA, preparazione dichiarazioni

## 👥 Gestione Utenti e Ruoli

**Ruoli Previsti:**
- **Amministratore**: Accesso completo a tutte le funzionalità
- **Manager**: Gestione operativa, report, configurazioni
- **Cassiere**: Operazioni cassa e vendite
- **Magazziniere**: Gestione inventario e acquisti

## 🔒 Sicurezza

- Autenticazione JWT con refresh token
- Autorizzazione basata su ruoli (RBAC)
- Crittografia dati sensibili
- Audit log di tutte le operazioni critiche
- Backup automatici giornalieri
- Session timeout per inattività

## 📱 Caratteristiche UX

- Interfaccia intuitiva e minimal
- Shortcuts da tastiera per operazioni rapide
- Modalità tablet-friendly per il POS
- Notifiche real-time
- Offline-first per operazioni critiche (PWA)
- Temi chiaro/scuro

## 🚀 Roadmap

### Fase 1 - MVP (3 mesi)
- ✅ Setup infrastruttura
- ✅ Gestione cassa base
- ✅ Catalogo prodotti
- ✅ Vendite semplici
- ✅ Dashboard essenziale

### Fase 2 - Espansione (3 mesi)
- 📍 Gestione acquisti completa
- 📍 Inventario avanzato
- 📍 Reportistica completa
- 📍 Gestione fornitori

### Fase 3 - Ottimizzazione (2 mesi)
- 🔜 Analytics avanzati
- 🔜 Integrazione fiscale
- 🔜 Mobile app
- 🔜 API per integrazioni esterne

### Fase 4 - Innovazione (ongoing)
- 💡 AI per previsione vendite
- 💡 Gestione fornitori automatica
- 💡 Loyalty program clienti
- 💡 Ordini online

## 📈 Metriche di Successo

- Riduzione tempi operativi del 40%
- Accuratezza inventario > 98%
- Quadratura cassa giornaliera < 5 min
- Tempo medio vendita < 30 sec
- Zero perdita dati
- Uptime > 99.5%

## 🛠️ Setup e Deployment

### Requisiti Sistema
- **Server**: Linux/Windows Server, 4GB RAM, 50GB storage
- **Client**: Browser moderni (Chrome, Firefox, Safari, Edge)
- **Database**: MySQL 8+ o MariaDB 10.6+
- **Network**: Connessione internet stabile (backup offline)

### Ambienti
- **Development**: Docker Compose locale
- **Staging**: Cloud VPS per testing
- **Production**: Server dedicato o cloud (Azure/AWS)

## 📞 Supporto e Manutenzione

- Documentazione utente completa
- Video tutorial per operazioni comuni
- Supporto tecnico via email/chat
- Aggiornamenti mensili
- SLA 99.5% uptime

---

**Versione:** 1.0.0  
**Ultimo Aggiornamento:** Novembre 2025  
**Contatto:** info@duedgusto.it