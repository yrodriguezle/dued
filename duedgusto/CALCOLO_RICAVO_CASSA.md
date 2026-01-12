# Calcolo Ricavo Cassa

## Formula del Ricavo Giornaliero

Il ricavo effettivo giornaliero viene calcolato con la seguente formula:

```
Ricavo = (Totale Chiusura Cassa + Pagamenti con Fattura) - (Apertura Cassa + Spese Fornitori + Spese Giornaliere)
```

### Campi Database

- **closingTotal**: Totale chiusura cassa (include tutto il contante contato)
- **invoicePayments**: Pagamenti ricevuti con fattura
- **openingTotal**: Apertura cassa (fondo cassa iniziale)
- **supplierExpenses**: Spese per fornitori
- **dailyExpenses**: Spese giornaliere

### Formula Implementata

```typescript
const dailyRevenue =
  (cr.closingTotal || 0) + (cr.invoicePayments || 0) -
  (cr.openingTotal || 0) - (cr.supplierExpenses || 0) - (cr.dailyExpenses || 0);
```

## Concetti Importanti

### Pago in Bianco (cashInWhite)
È quello che è stato battuto in cassa. Include:
- Contante battuto
- Pagamenti elettronici (che si battono per forza)

### Totale Chiusura
Il totale chiusura include:
- Il contante battuto (pago in bianco)
- La "frangia" di soldi non battuti (contante in nero)
- Tutto il contante fisicamente presente nella cassa alla chiusura

### Pagamenti Elettronici
I pagamenti elettronici sono sempre battuti in cassa, quindi sono inclusi nel "pago in bianco".

## Dashboard - Metriche Visualizzate

La dashboard mostra:

1. **Ricavo Totale**: Calcolato con la formula sopra
2. **Contanti in Bianco**: Il cashInWhite (quello battuto)
3. **Pagamenti Elettronici**: Gli electronicPayments
4. **Media Giornaliera**: Ricavo totale diviso per giorni lavorati

## Vista Mensile

Anche nella vista mensile, il totale mostrato per ogni giorno deve essere calcolato con la stessa formula del ricavo effettivo.

## Implementazione

### File Coinvolti

- `src/graphql/cashRegister/useQueryYearlySummary.tsx`: Calcola aggregati mensili/annuali
- `src/components/pages/cashRegister/CashRegisterDashboard.tsx`: Dashboard con KPI e grafici
- `src/components/pages/cashRegister/CashRegisterMonthlyPage.tsx`: Vista calendario mensile
- `src/graphql/cashRegister/fragments.tsx`: Definizione campi CashRegister

### Note per Future Sistemazioni

- Assicurarsi che TUTTE le viste (dashboard, mensile, lista) usino la stessa formula per il ricavo
- Il ricavo è l'indicatore finanziario principale, non il "totale vendite"
- Quando si aggiungono nuove metriche, verificare se ha senso usare il ricavo o altri valori
