using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using GraphQL;
using GraphQL.Types;
using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;

using duedgusto.GraphQL.Settings.Types;

namespace duedgusto.GraphQL.Settings;

public class SettingsMutations : ObjectGraphType
{
    public SettingsMutations()
    {
        this.Authorize();

        // Create or Update BusinessSettings
        Field<BusinessSettingsType, BusinessSettings>("updateBusinessSettings")
            .Argument<NonNullGraphType<BusinessSettingsInputType>>("settings", "Business settings data")
            .ResolveAsync(async context =>
            {
                try
                {
                    AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                    var input = context.GetArgument<BusinessSettingsInput>("settings");

                    BusinessSettings? settings = null;

                    // Try to get existing settings (normally only one record)
                    settings = await dbContext.BusinessSettings.FirstOrDefaultAsync();

                    if (settings == null)
                    {
                        // Create new
                        settings = new BusinessSettings();
                        dbContext.BusinessSettings.Add(settings);
                    }

                    // Update fields if provided
                    if (input != null)
                    {
                        if (!string.IsNullOrEmpty(input.BusinessName))
                        {
                            settings.BusinessName = input.BusinessName;
                        }

                        if (!string.IsNullOrEmpty(input.OpeningTime))
                        {
                            settings.OpeningTime = input.OpeningTime;
                        }

                        if (!string.IsNullOrEmpty(input.ClosingTime))
                        {
                            settings.ClosingTime = input.ClosingTime;
                        }

                        if (!string.IsNullOrEmpty(input.OperatingDays))
                        {
                            settings.OperatingDays = input.OperatingDays;
                        }

                        if (!string.IsNullOrEmpty(input.Timezone))
                        {
                            settings.Timezone = input.Timezone;
                        }

                        if (!string.IsNullOrEmpty(input.Currency))
                        {
                            settings.Currency = input.Currency;
                        }

                        if (input.VatRate.HasValue && input.VatRate.Value > 0)
                        {
                            settings.VatRate = input.VatRate.Value;
                        }
                    }

                    settings.UpdatedAt = DateTime.UtcNow;

                    await dbContext.SaveChangesAsync();
                    return settings;
                }
                catch (Exception)
                {
                    throw;
                }
            });

        // Create a new programming period
        Field<PeriodoProgrammazioneType, PeriodoProgrammazione>("creaPeriodo")
            .Argument<NonNullGraphType<PeriodoProgrammazioneInputType>>("periodo", "Period data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var input = context.GetArgument<PeriodoProgrammazioneInput>("periodo");

                if (string.IsNullOrEmpty(input.DataInizio))
                    throw new ExecutionError("dataInizio è obbligatorio");

                if (string.IsNullOrEmpty(input.GiorniOperativi))
                    throw new ExecutionError("giorniOperativi è obbligatorio");

                if (!DateOnly.TryParse(input.DataInizio, out var dataInizio))
                    throw new ExecutionError("dataInizio deve essere una data valida (formato: yyyy-MM-dd)");

                DateOnly? dataFine = null;
                if (!string.IsNullOrEmpty(input.DataFine))
                {
                    if (!DateOnly.TryParse(input.DataFine, out var df))
                        throw new ExecutionError("dataFine deve essere una data valida (formato: yyyy-MM-dd)");
                    dataFine = df;
                }

                // Validate giorniOperativi format: JSON array of 7 booleans
                bool[] giorni;
                try
                {
                    giorni = JsonSerializer.Deserialize<bool[]>(input.GiorniOperativi)!;
                    if (giorni == null || giorni.Length != 7)
                        throw new ExecutionError("giorniOperativi deve essere un array JSON di 7 valori booleani");
                }
                catch (JsonException)
                {
                    throw new ExecutionError("giorniOperativi deve essere un array JSON valido di 7 valori booleani");
                }

                await using var transaction = await dbContext.Database.BeginTransactionAsync();
                try
                {
                    var settings = await dbContext.BusinessSettings.FirstAsync();

                    // Check for overlaps with existing periods
                    var periodiEsistenti = await dbContext.PeriodiProgrammazione.ToListAsync();

                    // If new period is active (DataFine = null), close the current active period
                    if (dataFine == null)
                    {
                        var periodoAttivo = periodiEsistenti.FirstOrDefault(p => p.DataFine == null);
                        if (periodoAttivo != null)
                        {
                            periodoAttivo.DataFine = dataInizio.AddDays(-1);
                            periodoAttivo.AggiornatoIl = DateTime.UtcNow;
                        }
                    }
                    else
                    {
                        // Validate no overlaps for closed period
                        foreach (var p in periodiEsistenti)
                        {
                            var pFine = p.DataFine ?? DateOnly.MaxValue;
                            if (dataInizio <= pFine && dataFine.Value >= p.DataInizio)
                            {
                                throw new ExecutionError(
                                    $"Il periodo si sovrappone al periodo esistente ({p.DataInizio} - {(p.DataFine?.ToString() ?? "in corso")})"
                                );
                            }
                        }
                    }

                    var nuovo = new PeriodoProgrammazione
                    {
                        DataInizio = dataInizio,
                        DataFine = dataFine,
                        GiorniOperativi = input.GiorniOperativi,
                        SettingsId = settings.SettingsId,
                        CreatoIl = DateTime.UtcNow,
                        AggiornatoIl = DateTime.UtcNow
                    };

                    dbContext.PeriodiProgrammazione.Add(nuovo);

                    // Sync OperatingDays in BusinessSettings if the new period is active
                    if (dataFine == null)
                    {
                        settings.OperatingDays = input.GiorniOperativi;
                        settings.UpdatedAt = DateTime.UtcNow;
                    }

                    await dbContext.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return nuovo;
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });

        // Update an existing programming period
        Field<PeriodoProgrammazioneType, PeriodoProgrammazione>("aggiornaPeriodo")
            .Argument<NonNullGraphType<PeriodoProgrammazioneInputType>>("periodo", "Period data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var input = context.GetArgument<PeriodoProgrammazioneInput>("periodo");

                if (input.PeriodoId == null)
                    throw new ExecutionError("periodoId è obbligatorio per l'aggiornamento");

                var periodo = await dbContext.PeriodiProgrammazione
                    .FirstOrDefaultAsync(p => p.PeriodoId == input.PeriodoId.Value);

                if (periodo == null)
                    throw new ExecutionError($"Periodo con ID {input.PeriodoId} non trovato");

                // Validate giorniOperativi if provided
                if (!string.IsNullOrEmpty(input.GiorniOperativi))
                {
                    try
                    {
                        var giorni = JsonSerializer.Deserialize<bool[]>(input.GiorniOperativi);
                        if (giorni == null || giorni.Length != 7)
                            throw new ExecutionError("giorniOperativi deve essere un array JSON di 7 valori booleani");
                    }
                    catch (JsonException)
                    {
                        throw new ExecutionError("giorniOperativi deve essere un array JSON valido di 7 valori booleani");
                    }
                }

                // Parse dates from string input
                DateOnly? parsedDataInizio = null;
                if (!string.IsNullOrEmpty(input.DataInizio))
                {
                    if (!DateOnly.TryParse(input.DataInizio, out var di))
                        throw new ExecutionError("dataInizio deve essere una data valida (formato: yyyy-MM-dd)");
                    parsedDataInizio = di;
                }

                DateOnly? parsedDataFine = null;
                if (!string.IsNullOrEmpty(input.DataFine))
                {
                    if (!DateOnly.TryParse(input.DataFine, out var df))
                        throw new ExecutionError("dataFine deve essere una data valida (formato: yyyy-MM-dd)");
                    parsedDataFine = df;
                }

                // Validate no overlaps (excluding itself)
                var dataInizio = parsedDataInizio ?? periodo.DataInizio;
                var dataFine = parsedDataFine ?? periodo.DataFine;

                var altriPeriodi = await dbContext.PeriodiProgrammazione
                    .Where(p => p.PeriodoId != periodo.PeriodoId)
                    .ToListAsync();

                foreach (var p in altriPeriodi)
                {
                    var pFine = p.DataFine ?? DateOnly.MaxValue;
                    var miaFine = dataFine ?? DateOnly.MaxValue;
                    if (dataInizio <= pFine && miaFine >= p.DataInizio)
                    {
                        throw new ExecutionError(
                            $"Il periodo si sovrappone al periodo esistente ({p.DataInizio} - {(p.DataFine?.ToString() ?? "in corso")})"
                        );
                    }
                }

                // Update fields if provided
                if (parsedDataInizio != null)
                    periodo.DataInizio = parsedDataInizio.Value;

                // DataFine: allow setting to null or a value
                if (parsedDataFine != null)
                    periodo.DataFine = parsedDataFine;

                if (!string.IsNullOrEmpty(input.GiorniOperativi))
                    periodo.GiorniOperativi = input.GiorniOperativi;

                periodo.AggiornatoIl = DateTime.UtcNow;

                // Sync OperatingDays if this is the active period
                if (periodo.DataFine == null)
                {
                    var settings = await dbContext.BusinessSettings.FirstAsync();
                    settings.OperatingDays = periodo.GiorniOperativi;
                    settings.UpdatedAt = DateTime.UtcNow;
                }

                await dbContext.SaveChangesAsync();
                return periodo;
            });

        // Delete a programming period
        Field<BooleanGraphType, bool>("eliminaPeriodo")
            .Argument<NonNullGraphType<IntGraphType>>("periodoId", "Period ID to delete")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var periodoId = context.GetArgument<int>("periodoId");

                var periodo = await dbContext.PeriodiProgrammazione
                    .FirstOrDefaultAsync(p => p.PeriodoId == periodoId);

                if (periodo == null)
                    throw new ExecutionError($"Periodo con ID {periodoId} non trovato");

                // Cannot delete if it's the only period
                var count = await dbContext.PeriodiProgrammazione.CountAsync();
                if (count <= 1)
                    throw new ExecutionError("Deve esistere almeno un periodo di programmazione");

                // Cannot delete the active period
                if (periodo.DataFine == null)
                    throw new ExecutionError("Non puoi eliminare il periodo attivo. Crea prima un nuovo periodo.");

                dbContext.PeriodiProgrammazione.Remove(periodo);
                await dbContext.SaveChangesAsync();

                return true;
            });
    }
}
