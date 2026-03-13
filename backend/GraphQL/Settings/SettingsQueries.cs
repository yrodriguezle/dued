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
    }
}
