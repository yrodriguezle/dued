using System.Text.Json;
using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.CashManagement.Types;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.CashManagement;

public class CashManagementMutations : ObjectGraphType
{
    public CashManagementMutations()
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
                var operatingDays = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;
                // Mappa DayOfWeek (.NET: 0=Sunday) a indice array (0=Monday)
                int operatingDayIndex = ((int)input.Data.DayOfWeek + 6) % 7;
                if (!operatingDays[operatingDayIndex])
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

                // Update legacy expense fields
                registroCassa.SpeseFornitori = input.SpeseFornitori;
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

                // Reload with navigation properties
                return await dbContext.RegistriCassa
                    .Include(r => r.Utente)
                        .ThenInclude(u => u.Ruolo)
                    .Include(r => r.ConteggiMoneta)
                        .ThenInclude(c => c.Denominazione)
                    .Include(r => r.IncassiCassa)
                    .Include(r => r.SpeseCassa)
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
