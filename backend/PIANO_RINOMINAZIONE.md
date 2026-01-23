# Piano di Rinominazione Entità - Italiano

## Panoramica
Questo documento descrive il piano per rinominare tutte le entità del progetto DuedGusto da inglese a italiano.

---

## Fase 1: Gestione Cassa (COMPLETATA)

### Backend
| Inglese | Italiano | Stato |
|---------|----------|-------|
| CashRegister | RegistroCassa | ✅ Completato |
| CashDenomination | DenominazioneMoneta | ✅ Completato |
| CashCount | ConteggioMoneta | ✅ Completato |
| CashIncome | IncassoCassa | ✅ Completato |
| CashExpense | SpesaCassa | ✅ Completato |

### Proprietà RegistroCassa
| Inglese | Italiano | Stato |
|---------|----------|-------|
| RegisterId | Id | ✅ |
| Date | Data | ✅ |
| OpeningTotal | TotaleApertura | ✅ |
| ClosingTotal | TotaleChiusura | ✅ |
| CashSales | VenditeContanti | ✅ |
| CashInWhite | IncassoContanteTracciato | ✅ |
| ElectronicPayments | IncassiElettronici | ✅ |
| InvoicePayments | IncassiFattura | ✅ |
| TotalSales | TotaleVendite | ✅ |
| SupplierExpenses | SpeseFornitori | ✅ |
| DailyExpenses | SpeseGiornaliere | ✅ |
| ExpectedCash | ContanteAtteso | ✅ |
| Difference | Differenza | ✅ |
| NetCash | ContanteNetto | ✅ |
| VatAmount | ImportoIva | ✅ |
| Notes | Note | ✅ |
| Status | Stato | ✅ |

### Frontend
| File/Componente | Stato |
|-----------------|-------|
| @types/CashRegister.d.ts | ✅ Completato (con alias inglesi) |
| graphql/cashRegister/fragments.tsx | ✅ Completato |
| graphql/cashRegister/queries.tsx | ✅ Completato |
| graphql/cashRegister/mutations.tsx | ✅ Completato |
| graphql/cashRegister/hooks | ✅ Completato (con mapping IT→EN) |
| Componenti React | ⏳ Usano alias inglesi (da migrare in futuro) |

**Nota:** Gli hooks mappano automaticamente i campi italiani dal GraphQL ai nomi inglesi per retrocompatibilità con i componenti esistenti. I componenti possono essere migrati gradualmente.

---

## Fase 2: Prodotti e Vendite (DA FARE)

### Backend
| Inglese | Italiano |
|---------|----------|
| Product | Prodotto |
| Sale | Vendita |

### Proprietà Prodotto
| Inglese | Italiano |
|---------|----------|
| ProductId | Id |
| Code | Codice |
| Name | Nome |
| Description | Descrizione |
| Price | Prezzo |
| Category | Categoria |
| Unit | Unita |
| IsActive | Attivo |

### Proprietà Vendita
| Inglese | Italiano |
|---------|----------|
| SaleId | Id |
| RegisterId | RegistroCassaId |
| ProductId | ProdottoId |
| Quantity | Quantita |
| UnitPrice | PrezzoUnitario |
| TotalPrice | PrezzoTotale |
| Notes | Note |
| Timestamp | DataOra |

---

## Fase 3: Impostazioni Aziendali (DA FARE)

### Backend
| Inglese | Italiano |
|---------|----------|
| BusinessSettings | ImpostazioniAziendali |

### Proprietà
| Inglese | Italiano |
|---------|----------|
| SettingsId | Id |
| BusinessName | NomeAzienda |
| VatNumber | PartitaIva |
| Address | Indirizzo |
| Phone | Telefono |
| Email | Email |
| DefaultVatRate | AliquotaIvaDefault |
| Currency | Valuta |
| FiscalYearStart | InizioAnnoFiscale |

---

## Fase 4: Sincronizzazione Frontend (DA FARE)

Per ogni fase backend completata:
1. Aggiornare types TypeScript
2. Aggiornare query/mutation GraphQL
3. Aggiornare stores Pinia
4. Aggiornare componenti Vue
5. Testare funzionalità

---

## Note Tecniche

### Migration Database
Ogni fase richiede una migration EF Core per:
- Rinominare tabelle
- Rinominare colonne
- Aggiornare foreign keys
- Aggiornare indici

### Compatibilità
- Le API GraphQL mantengono i nomi dei field per retrocompatibilità
- I types interni usano nomi italiani
- I componenti Vue vengono aggiornati progressivamente
