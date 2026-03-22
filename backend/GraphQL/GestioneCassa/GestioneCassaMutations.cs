using System.Text.Json;
using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.GraphQL.Subscriptions.Types;

namespace duedgusto.GraphQL.GestioneCassa;

public class GestioneCassaMutations : ObjectGraphType
{
    public GestioneCassaMutations()
    {
        this.Authorize();

        // Create or Update RegistroCassa
        Field<RegistroCassaType>("mutateRegistroCassa")
            .Argument<NonNullGraphType<RegistroCassaInputType>>("registroCassa", "Dati registro cassa")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                RegistroCassaInput input = context.GetArgument<RegistroCassaInput>("registroCassa");

                // Guard: verifica che la data non appartenga a un mese chiuso
                var chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
                if (await chiusuraService.DataAppartieneAMeseChiusoAsync(input.Data))
                {
                    throw new ExecutionError(
                        $"Impossibile modificare il registro: il mese {input.Data:MM/yyyy} è chiuso.");
                }

                // Guard: verifica che la data sia un giorno operativo
                var settings = await dbContext.BusinessSettings.FirstAsync();
                // Mappa DayOfWeek (.NET: 0=Sunday) a indice array (0=Monday)
                int operatingDayIndex = ((int)input.Data.DayOfWeek + 6) % 7;
                var dataOnly = DateOnly.FromDateTime(input.Data);

                // Controlla prima i periodi di programmazione
                var periodi = await dbContext.PeriodiProgrammazione.ToListAsync();
                bool isOperatingDay;

                if (periodi.Count > 0)
                {
                    var periodo = periodi.FirstOrDefault(p =>
                        p.DataInizio <= dataOnly && (p.DataFine == null || p.DataFine >= dataOnly));

                    if (periodo == null)
                    {
                        var nomeGiorno = input.Data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
                        throw new ExecutionError(
                            $"Impossibile creare un registro cassa: nessun periodo di programmazione copre la data ({nomeGiorno} {input.Data:dd/MM/yyyy}).");
                    }

                    var giorniPeriodo = JsonSerializer.Deserialize<bool[]>(periodo.GiorniOperativi)!;
                    isOperatingDay = giorniPeriodo[operatingDayIndex];
                }
                else
                {
                    // Fallback alle impostazioni globali se non ci sono periodi
                    var operatingDays = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;
                    isOperatingDay = operatingDays[operatingDayIndex];
                }

                if (!isOperatingDay)
                {
                    var nomeGiorno = input.Data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
                    throw new ExecutionError(
                        $"Impossibile creare un registro cassa per un giorno di chiusura ({nomeGiorno} {input.Data:dd/MM/yyyy}).");
                }

                RegistroCassa? registroCassa = null;

                // Check if a cash register already exists for this date
                registroCassa = await dbContext.RegistriCassa
                    .Include(r => r.ConteggiMoneta)
                    .Include(r => r.IncassiCassa)
                    .Include(r => r.SpeseCassa)
                    .FirstOrDefaultAsync(r => r.Data.Date == input.Data.Date);

                if (registroCassa != null)
                {
                    // Update existing record - remove existing counts, incomes, and expenses
                    dbContext.ConteggiMoneta.RemoveRange(registroCassa.ConteggiMoneta);
                    dbContext.IncassiCassa.RemoveRange(registroCassa.IncassiCassa);
                    dbContext.SpeseCassa.RemoveRange(registroCassa.SpeseCassa);
                }
                else
                {
                    // Create new record
                    registroCassa = new RegistroCassa();
                    dbContext.RegistriCassa.Add(registroCassa);
                }

                // Update basic fields
                registroCassa.Data = input.Data;
                registroCassa.UtenteId = input.UtenteId;
                registroCassa.IncassoContanteTracciato = input.IncassoContanteTracciato;
                registroCassa.IncassiElettronici = input.IncassiElettronici;
                registroCassa.IncassiFattura = input.IncassiFattura;
                registroCassa.SpeseFornitori = input.SpeseFornitori;
                registroCassa.SpeseGiornaliere = input.SpeseGiornaliere;
                registroCassa.Note = input.Note;
                registroCassa.Stato = input.Stato;
                registroCassa.AggiornatoIl = DateTime.UtcNow;

                // Get denominations for calculations
                var denominazioni = await dbContext.DenominazioniMoneta.ToListAsync();

                // Calculate opening total
                decimal totaleApertura = 0;
                foreach (var conteggioInput in input.ConteggiApertura)
                {
                    var denominazione = denominazioni.FirstOrDefault(d => d.Id == conteggioInput.DenominazioneMonetaId);
                    if (denominazione != null)
                    {
                        decimal totale = conteggioInput.Quantita * denominazione.Valore;
                        totaleApertura += totale;

                        registroCassa.ConteggiMoneta.Add(new ConteggioMoneta
                        {
                            DenominazioneMonetaId = conteggioInput.DenominazioneMonetaId,
                            Quantita = conteggioInput.Quantita,
                            Totale = totale,
                            IsApertura = true
                        });
                    }
                }

                // Calculate closing total
                decimal totaleChiusura = 0;
                foreach (var conteggioInput in input.ConteggiChiusura)
                {
                    var denominazione = denominazioni.FirstOrDefault(d => d.Id == conteggioInput.DenominazioneMonetaId);
                    if (denominazione != null)
                    {
                        decimal totale = conteggioInput.Quantita * denominazione.Valore;
                        totaleChiusura += totale;

                        registroCassa.ConteggiMoneta.Add(new ConteggioMoneta
                        {
                            DenominazioneMonetaId = conteggioInput.DenominazioneMonetaId,
                            Quantita = conteggioInput.Quantita,
                            Totale = totale,
                            IsApertura = false
                        });
                    }
                }

                registroCassa.TotaleApertura = totaleApertura;
                registroCassa.TotaleChiusura = totaleChiusura;

                // Add incomes
                decimal incassoContanteTracciatoDaIncassi = 0;
                decimal incassiElettroniciDaIncassi = 0;
                decimal incassiFatturaDaIncassi = 0;
                foreach (var incassoInput in input.Incassi)
                {
                    registroCassa.IncassiCassa.Add(new IncassoCassa
                    {
                        Tipo = incassoInput.Tipo,
                        Importo = incassoInput.Importo
                    });

                    // Map to legacy fields based on type
                    if (incassoInput.Tipo == "Pago in Bianco (Contante)")
                    {
                        incassoContanteTracciatoDaIncassi = incassoInput.Importo;
                    }
                    else if (incassoInput.Tipo == "Pagamenti Elettronici")
                    {
                        incassiElettroniciDaIncassi = incassoInput.Importo;
                    }
                    else if (incassoInput.Tipo == "Pagamento con Fattura")
                    {
                        incassiFatturaDaIncassi = incassoInput.Importo;
                    }
                }

                // Override input values with ones from incomes if provided
                if (input.Incassi.Count > 0)
                {
                    registroCassa.IncassoContanteTracciato = incassoContanteTracciatoDaIncassi;
                    registroCassa.IncassiElettronici = incassiElettroniciDaIncassi;
                    registroCassa.IncassiFattura = incassiFatturaDaIncassi;
                }
                else
                {
                    // Fallback to legacy input fields if incomes not provided
                    registroCassa.IncassoContanteTracciato = input.IncassoContanteTracciato;
                    registroCassa.IncassiElettronici = input.IncassiElettronici;
                    registroCassa.IncassiFattura = input.IncassiFattura;
                }

                // Add expenses
                decimal totaleSpese = 0;
                foreach (var spesaInput in input.Spese)
                {
                    registroCassa.SpeseCassa.Add(new SpesaCassa
                    {
                        Descrizione = spesaInput.Descrizione,
                        Importo = spesaInput.Importo
                    });
                    totaleSpese += spesaInput.Importo;
                }

                // Process supplier payments from cash register (7-step upsert algorithm)
                // Save first to ensure registroCassa.Id is available for new registers
                await dbContext.SaveChangesAsync();

                var pagamentiInput = input.PagamentiFornitori;

                // STEP 1: Load existing payments for this register
                var existingPayments = await dbContext.PagamentiFornitori
                    .Where(p => p.RegistroCassaId == registroCassa.Id)
                    .ToListAsync();

                // STEP 2: Build maps
                var inputById = pagamentiInput
                    .Where(p => p.PagamentoId != null)
                    .ToDictionary(p => p.PagamentoId!.Value);
                var inputNew = pagamentiInput
                    .Where(p => p.PagamentoId == null)
                    .ToList();
                var inputIds = inputById.Keys.ToHashSet();

                // STEP 3: Determine operations
                var toDelete = existingPayments
                    .Where(p => !inputIds.Contains(p.PagamentoId))
                    .ToList();
                var toUpdate = existingPayments
                    .Where(p => inputIds.Contains(p.PagamentoId))
                    .ToList();

                // STEP 4: DELETE removed payments
                var orphanFatturaIds = toDelete
                    .Where(p => p.FatturaId.HasValue)
                    .Select(p => p.FatturaId!.Value)
                    .ToList();
                var orphanDdtIds = toDelete
                    .Where(p => p.DdtId.HasValue)
                    .Select(p => p.DdtId!.Value)
                    .ToList();

                dbContext.PagamentiFornitori.RemoveRange(toDelete);

                if (toDelete.Count > 0)
                    await dbContext.SaveChangesAsync();

                // Clean up orphan documents (no remaining pagamenti referencing them)
                if (orphanFatturaIds.Count > 0)
                {
                    var orphanFatture = await dbContext.FattureAcquisto
                        .Where(f => orphanFatturaIds.Contains(f.FatturaId))
                        .Where(f => !dbContext.PagamentiFornitori.Any(p => p.FatturaId == f.FatturaId))
                        .ToListAsync();
                    dbContext.FattureAcquisto.RemoveRange(orphanFatture);
                }
                if (orphanDdtIds.Count > 0)
                {
                    var orphanDdts = await dbContext.DocumentiTrasporto
                        .Where(d => orphanDdtIds.Contains(d.DdtId) && d.FatturaId == null)
                        .Where(d => !dbContext.PagamentiFornitori.Any(p => p.DdtId == d.DdtId))
                        .ToListAsync();
                    dbContext.DocumentiTrasporto.RemoveRange(orphanDdts);
                }

                if (orphanFatturaIds.Count > 0 || orphanDdtIds.Count > 0)
                    await dbContext.SaveChangesAsync();

                // STEP 5: UPDATE existing payments
                toUpdate.ForEach(existing =>
                {
                    var inp = inputById[existing.PagamentoId];
                    existing.Importo = inp.Importo;
                    existing.MetodoPagamento = inp.MetodoPagamento;
                    existing.AggiornatoIl = DateTime.UtcNow;
                    // Do NOT change FatturaId/DdtId — preserve original document link
                });

                // STEP 6: CREATE new payments (sequential — DbContext is not thread-safe)
                foreach (var pagInput in inputNew)
                {
                    int? fatturaId = null;
                    int? ddtId = null;

                    if (pagInput.FatturaId != null)
                    {
                        // Priority 1: Link to existing FatturaAcquisto
                        fatturaId = pagInput.FatturaId;
                    }
                    else if (pagInput.TipoDocumento == "FA")
                    {
                        // Priority 2: Create new FatturaAcquisto
                        var fattura = new FatturaAcquisto
                        {
                            FornitoreId = pagInput.FornitoreId,
                            NumeroFattura = pagInput.NumeroFattura ?? "",
                            DataFattura = pagInput.DataFattura ?? input.Data,
                            Imponibile = pagInput.Importo,
                            Stato = "PAGATA",
                        };
                        dbContext.FattureAcquisto.Add(fattura);
                        await dbContext.SaveChangesAsync();
                        fatturaId = fattura.FatturaId;
                    }
                    else if (pagInput.DdtId != null)
                    {
                        // Priority 3: Link to existing DocumentoTrasporto
                        ddtId = pagInput.DdtId;
                    }
                    else
                    {
                        // Priority 4: Create new DocumentoTrasporto
                        var ddt = new DocumentoTrasporto
                        {
                            FornitoreId = pagInput.FornitoreId,
                            NumeroDdt = pagInput.NumeroDdt,
                            DataDdt = pagInput.DataDdt ?? input.Data,
                            Importo = pagInput.Importo,
                            FatturaId = null,
                        };
                        dbContext.DocumentiTrasporto.Add(ddt);
                        await dbContext.SaveChangesAsync();
                        ddtId = ddt.DdtId;
                    }

                    dbContext.PagamentiFornitori.Add(new PagamentoFornitore
                    {
                        FatturaId = fatturaId,
                        DdtId = ddtId,
                        DataPagamento = input.Data,
                        Importo = pagInput.Importo,
                        MetodoPagamento = pagInput.MetodoPagamento,
                        Note = $"Pagamento da registro cassa del {input.Data:dd/MM/yyyy}",
                        RegistroCassaId = registroCassa.Id,
                    });
                }

                // STEP 7: SaveChanges and recalculate SpeseFornitori
                await dbContext.SaveChangesAsync();

                var totalePagamentiFornitori = await dbContext.PagamentiFornitori
                    .Where(p => p.RegistroCassaId == registroCassa.Id)
                    .SumAsync(p => p.Importo);

                registroCassa.SpeseFornitori = totalePagamentiFornitori;
                registroCassa.SpeseGiornaliere = totaleSpese;

                // TODO: Get actual sales data from sales table when implemented
                // For now, use placeholder values
                registroCassa.VenditeContanti = 0;
                registroCassa.TotaleVendite = registroCassa.VenditeContanti + registroCassa.IncassiElettronici + registroCassa.IncassoContanteTracciato + registroCassa.IncassiFattura;

                // Calculate expected cash and difference
                registroCassa.ContanteAtteso = registroCassa.VenditeContanti - registroCassa.SpeseFornitori - registroCassa.SpeseGiornaliere;
                decimal incassoGiornaliero = registroCassa.TotaleChiusura - registroCassa.TotaleApertura;
                registroCassa.Differenza = incassoGiornaliero - registroCassa.ContanteAtteso;
                registroCassa.ContanteNetto = incassoGiornaliero;

                // Calcolo IVA con scorporo (prezzi IVA inclusa, normativa italiana)
                decimal aliquotaIva = settings.VatRate; // es. 0.10 per ristorazione
                registroCassa.ImportoIva = Math.Round(
                    registroCassa.TotaleVendite * (aliquotaIva / (1 + aliquotaIva)), 2);

                await dbContext.SaveChangesAsync();

                // Publish event for real-time subscriptions
                var eventBus = GraphQLService.GetService<IEventBus>(context);
                eventBus.Publish(new RegistroCassaUpdatedEvent
                {
                    RegistroCassaId = registroCassa.Id,
                    Data = registroCassa.Data,
                    Stato = registroCassa.Stato ?? string.Empty,
                    TotaleVendite = registroCassa.TotaleVendite,
                    TotaleApertura = registroCassa.TotaleApertura,
                    TotaleChiusura = registroCassa.TotaleChiusura,
                    Azione = "UPDATED"
                });

                // Reload with navigation properties
                return await dbContext.RegistriCassa
                    .Include(r => r.Utente)
                        .ThenInclude(u => u.Ruolo)
                    .Include(r => r.ConteggiMoneta)
                        .ThenInclude(c => c.Denominazione)
                    .Include(r => r.IncassiCassa)
                    .Include(r => r.SpeseCassa)
                    .Include(r => r.PagamentiFornitori)
                        .ThenInclude(p => p.Ddt)
                            .ThenInclude(d => d!.Fornitore)
                    .Include(r => r.PagamentiFornitori)
                        .ThenInclude(p => p.Fattura)
                            .ThenInclude(f => f!.Fornitore)
                    .FirstOrDefaultAsync(r => r.Id == registroCassa.Id);
            });

        // Close cash register (set status to CLOSED)
        Field<RegistroCassaType>("chiudiRegistroCassa")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int registroCassaId = context.GetArgument<int>("registroCassaId");

                var registroCassa = await dbContext.RegistriCassa
                    .Include(r => r.Utente)
                        .ThenInclude(u => u.Ruolo)
                    .Include(r => r.ConteggiMoneta)
                        .ThenInclude(c => c.Denominazione)
                    .Include(r => r.IncassiCassa)
                    .Include(r => r.SpeseCassa)
                    .FirstOrDefaultAsync(r => r.Id == registroCassaId);

                if (registroCassa == null)
                {
                    throw new Exception($"Registro cassa con ID {registroCassaId} non trovato");
                }

                if (registroCassa.Stato == "CLOSED" || registroCassa.Stato == "RECONCILED")
                {
                    throw new Exception("Il registro cassa è già chiuso");
                }

                // Guard: verifica che non appartenga a un mese chiuso
                var chiusuraServiceClose = GraphQLService.GetService<ChiusuraMensileService>(context);
                if (await chiusuraServiceClose.DataAppartieneAMeseChiusoAsync(registroCassa.Data))
                {
                    throw new ExecutionError(
                        $"Impossibile modificare il registro: il mese {registroCassa.Data:MM/yyyy} è chiuso.");
                }

                // Guard: verifica che la data sia un giorno operativo
                var settingsClose = await dbContext.BusinessSettings.FirstAsync();
                var operatingDaysClose = JsonSerializer.Deserialize<bool[]>(settingsClose.OperatingDays)!;
                int operatingDayIndexClose = ((int)registroCassa.Data.DayOfWeek + 6) % 7;
                if (!operatingDaysClose[operatingDayIndexClose])
                {
                    var nomeGiornoClose = registroCassa.Data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
                    throw new ExecutionError(
                        $"Impossibile chiudere un registro cassa per un giorno di chiusura ({nomeGiornoClose} {registroCassa.Data:dd/MM/yyyy}).");
                }

                registroCassa.Stato = "CLOSED";
                registroCassa.AggiornatoIl = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();

                // Publish chiusura event for real-time subscriptions
                var eventBusClose = GraphQLService.GetService<IEventBus>(context);
                eventBusClose.Publish(new ChiusuraCassaCompletedEvent
                {
                    RegistroCassaId = registroCassa.Id,
                    Data = registroCassa.Data,
                    TotaleChiusura = registroCassa.TotaleChiusura,
                    Differenza = registroCassa.Differenza
                });

                // Also publish as a general registro update
                eventBusClose.Publish(new RegistroCassaUpdatedEvent
                {
                    RegistroCassaId = registroCassa.Id,
                    Data = registroCassa.Data,
                    Stato = registroCassa.Stato,
                    TotaleVendite = registroCassa.TotaleVendite,
                    TotaleApertura = registroCassa.TotaleApertura,
                    TotaleChiusura = registroCassa.TotaleChiusura,
                    Azione = "CLOSED"
                });

                return registroCassa;
            });

        // Delete cash register
        Field<BooleanGraphType>("eliminaRegistroCassa")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int registroCassaId = context.GetArgument<int>("registroCassaId");

                var registroCassa = await dbContext.RegistriCassa
                    .Include(r => r.ConteggiMoneta)
                    .Include(r => r.IncassiCassa)
                    .Include(r => r.SpeseCassa)
                    .FirstOrDefaultAsync(r => r.Id == registroCassaId);

                if (registroCassa == null)
                {
                    throw new Exception($"Registro cassa con ID {registroCassaId} non trovato");
                }

                // Only allow deletion of DRAFT registers
                if (registroCassa.Stato != "DRAFT")
                {
                    throw new Exception("Solo i registri cassa in bozza possono essere eliminati");
                }

                // Guard: verifica che non appartenga a un mese chiuso
                var chiusuraServiceDelete = GraphQLService.GetService<ChiusuraMensileService>(context);
                if (await chiusuraServiceDelete.DataAppartieneAMeseChiusoAsync(registroCassa.Data))
                {
                    throw new ExecutionError(
                        $"Impossibile eliminare il registro: il mese {registroCassa.Data:MM/yyyy} è chiuso.");
                }

                dbContext.RegistriCassa.Remove(registroCassa);
                await dbContext.SaveChangesAsync();

                return true;
            });
    }
}
