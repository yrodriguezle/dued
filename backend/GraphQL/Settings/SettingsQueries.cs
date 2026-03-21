using Microsoft.EntityFrameworkCore;
using GraphQL;
using GraphQL.Types;
using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;

namespace duedgusto.GraphQL.Settings;

using duedgusto.GraphQL.Settings.Types;

public class SettingsQueries : ObjectGraphType
{
    public SettingsQueries()
    {
        this.Authorize();

        // Get business settings
        Field<BusinessSettingsType, BusinessSettings>("businessSettings")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.BusinessSettings
                    .FirstOrDefaultAsync();
            });

        // Get all programming periods ordered by DataInizio DESC
        Field<ListGraphType<NonNullGraphType<PeriodoProgrammazioneType>>, List<PeriodoProgrammazione>>("periodiProgrammazione")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.PeriodiProgrammazione
                    .OrderByDescending(p => p.DataInizio)
                    .ToListAsync();
            });

        // Get active period (DataFine = null)
        Field<PeriodoProgrammazioneType, PeriodoProgrammazione>("periodoAttivo")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.PeriodiProgrammazione
                    .FirstOrDefaultAsync(p => p.DataFine == null);
            });

        // Get non-working days, optionally filtered by year
        Field<ListGraphType<NonNullGraphType<GiornoNonLavorativoType>>, List<GiornoNonLavorativo>>("giorniNonLavorativi")
            .Argument<IntGraphType>("anno", "Anno per filtrare i giorni non lavorativi")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var anno = context.GetArgument<int?>("anno");

                IQueryable<GiornoNonLavorativo> query = dbContext.GiorniNonLavorativi;

                if (anno.HasValue)
                {
                    // Filtra per anno della data O ricorrenti (che valgono per tutti gli anni)
                    query = query.Where(g => g.Data.Year == anno.Value || g.Ricorrente);
                }

                return await query
                    .OrderBy(g => g.Data)
                    .ToListAsync();
            });
    }
}
