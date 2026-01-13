# Calcolo Ricavo Cassa

## Struttura Giornata Tipo

### Esempio Pratico
```
Apertura:        €  3.65
Totale Cassa:    € 48.55
Chiusura:        € 44.90  (Totale - Apertura)

Totale Cassa:               € 328.70
Totale (-) Apertura:        € 280.15  (328.70 - 48.55)
Pago in contanti:           € 115.30  (battuto sulla cassa fiscale)
Elettronico:                €  44.00  (battuto sulla cassa fiscale)
Totale Vendite:             € 324.15  (280.15 + 44.00)
Fornitori 20%:              €  50.00  (accantonamento spese fornitori)
NC 20% ecc:                 €  65.30  (non battuto in cassa fiscale)
ECC:                        € 164.85  (324.15 - 115.30 - 44.00)
Resto:                      €  64.85
```

## Concetti Importanti

### Totale Cassa (closingTotal)
È la somma fisica di tutto il denaro contato nella cassa alla chiusura. Include:
- Il contante battuto sulla cassa fiscale (Pago in contanti)
- Il contante NON battuto (ECC - quello in nero)
- Tutto il denaro fisicamente presente

### Totale (-) Apertura
È il risultato di: `Totale Cassa - Apertura`
Rappresenta l'incasso giornaliero lordo in contanti.

### Pago in Contanti (cashInWhite)
È il contante che è stato **battuto sulla cassa fiscale**.
- Si registra sulla cassa fiscale
- È tracciato ufficialmente
- È diverso dal totale contante fisico in cassa

### Pagamenti Elettronici (electronicPayments)
Sono i pagamenti con carta/bancomat che sono stati **battuti sulla cassa fiscale**.
- Si devono registrare per forza sulla cassa fiscale
- Sono sempre tracciati

### Totale Vendite
Formula: `(Totale Cassa - Apertura) + Elettronico`
Rappresenta il totale delle vendite giornaliere (contanti + elettronici).

### Fornitori 20%
È un accantonamento del 20% giornaliero per le spese dei fornitori.
Non è una spesa effettiva ma una riserva.

### ECC (NC 20% ecc)
È il contante **NON battuto** sulla cassa fiscale.
Formula: `Totale Vendite - Pago in contanti - Elettronico`
Esempio: `324.15 - 115.30 - 44.00 = 164.85`

Rappresenta la "frangia" di soldi in nero.

### Pagamento con Fattura (invoicePayments)
Sono i pagamenti ricevuti con fattura emessa.
- Tracciati completamente
- Separati dal contante e dagli elettronici
- Vanno aggiunti al ricavo effettivo

## Formula del Ricavo Giornaliero

Il ricavo effettivo giornaliero viene calcolato con la seguente formula:

```
Ricavo = (Totale Chiusura Cassa + Pagamenti con Fattura) - (Apertura Cassa + Spese Totali)
```

### Campi Database

- **closingTotal**: Totale chiusura cassa (tutto il contante contato fisicamente)
- **openingTotal**: Apertura cassa (fondo cassa iniziale)
- **cashInWhite**: Contante battuto sulla cassa fiscale
- **electronicPayments**: Pagamenti elettronici battuti sulla cassa fiscale
- **invoicePayments**: Pagamenti ricevuti con fattura
- **supplierExpenses**: Spese effettive per fornitori
- **dailyExpenses**: Spese giornaliere effettive

### Formula Implementata

```typescript
const dailyRevenue =
  (cr.closingTotal || 0) + (cr.invoicePayments || 0) -
  (cr.openingTotal || 0) - (cr.supplierExpenses || 0) - (cr.dailyExpenses || 0);
```

## Relazioni tra i Valori

```
Totale Cassa (closingTotal) = Pago in contanti (cashInWhite) + ECC (non battuto) + resto apertura

Totale (-) Apertura = closingTotal - openingTotal

Totale Vendite = (closingTotal - openingTotal) + electronicPayments

ECC = Totale Vendite - cashInWhite - electronicPayments
```

## Dashboard - Metriche Visualizzate

La dashboard mostra:

1. **Ricavo Totale**: Calcolato con la formula del ricavo giornaliero
2. **Pago in contanti**: Il cashInWhite (contante battuto sulla cassa fiscale)
3. **Pagamenti Elettronici**: Gli electronicPayments (battuti sulla cassa fiscale)
4. **Pagamenti con Fattura**: Gli invoicePayments (tracciati completamente)
5. **Media Giornaliera**: Ricavo totale diviso per giorni lavorati

## Vista Lista Cassa

La lista delle chiusure cassa mostra:

- **Data**: Data della chiusura
- **Operatore**: Utente che ha effettuato la chiusura
- **Apertura**: Fondo cassa iniziale (openingTotal)
- **Chiusura**: Totale contante contato (closingTotal)
- **Ricavo**: Calcolato con la formula del ricavo giornaliero
- **Pago in contanti**: Contante battuto sulla cassa fiscale (cashInWhite)
- **Pagamenti Elettronici**: Elettronici battuti (electronicPayments)
- **Pagamenti Fattura**: Pagamenti con fattura (invoicePayments)
- **Spese Totali**: Somma di supplierExpenses e dailyExpenses
- **Differenza**: Discrepanza tra contante atteso e contante effettivo
- **Stato**: DRAFT, CLOSED, RECONCILED

## Vista Mensile

Anche nella vista mensile, il totale mostrato per ogni giorno deve essere calcolato con la stessa formula del ricavo effettivo.

## Implementazione

### File Coinvolti

- `src/graphql/cashRegister/useQueryYearlySummary.tsx`: Calcola aggregati mensili/annuali
- `src/components/pages/cashRegister/CashRegisterDashboard.tsx`: Dashboard con KPI e grafici
- `src/components/pages/cashRegister/CashRegisterList.tsx`: Lista chiusure cassa
- `src/components/pages/cashRegister/CashRegisterDetails.tsx`: Dettaglio/modifica chiusura
- `src/components/pages/cashRegister/CashSummary.tsx`: Riepilogo vendite
- `src/components/pages/cashRegister/CashRegisterMonthlyPage.tsx`: Vista calendario mensile
- `src/graphql/cashRegister/fragments.tsx`: Definizione campi CashRegister

### Note per Future Sistemazioni

- Assicurarsi che TUTTE le viste (dashboard, mensile, lista) usino la stessa formula per il ricavo
- Il ricavo è l'indicatore finanziario principale, non il "totale vendite"
- L'ECC (non battuto) non è memorizzato nel database ma può essere calcolato: `Totale Vendite - cashInWhite - electronicPayments`
- Il "Fornitori 20%" è un accantonamento, non una spesa effettiva registrata
- Quando si aggiungono nuove metriche, verificare se ha senso usare il ricavo o altri valori
