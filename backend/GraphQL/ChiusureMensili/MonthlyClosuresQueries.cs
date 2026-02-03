using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.ChiusureMensili.Types;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.ChiusureMensili;

public class MonthlyClosuresQueries : ObjectGraphType
{
    public MonthlyClosuresQueries()
    {
        this.Authorize();

        // Get monthly closure by ID - AGGIORNATA per includere nuove relazioni
        Field<ChiusuraMensileType, ChiusuraMensile>("chiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                var service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int closureId = context.GetArgument<int>("chiusuraId");

                // Usa il service che carica tutte le relazioni necessarie
                var result = await service.GetChiusuraConRelazioniAsync(closureId);
                return result;
            });

        // Get all monthly closures, optionally filtered by year - AGGIORNATA per includere nuove relazioni
        Field<ListGraphType<ChiusuraMensileType>, IEnumerable<ChiusuraMensile>>("chiusureMensili")
            .Argument<IntGraphType>("anno")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int? year = context.GetArgument<int?>("anno");

                IQueryable<ChiusuraMensile> query = dbContext.ChiusureMensili;

                if (year.HasValue)
                {
                    query = query.Where(c => c.Anno == year.Value);
                }

                // Includi tutte le relazioni necessarie per le proprietà calcolate
                return await query
                    .Include(c => c.ChiusaDaUtente)
                    .Include(c => c.RegistriInclusi)
                        .ThenInclude(r => r.Registro)
                    .Include(c => c.SpeseLibere)
                    .Include(c => c.PagamentiInclusi)
                        .ThenInclude(p => p.Pagamento)
                    .OrderByDescending(c => c.Anno)
                        .ThenByDescending(c => c.Mese)
                    .ToListAsync();
            });

        // ✅ NUOVA QUERY: Valida completezza registri per un mese
        Field<ListGraphType<DateTimeGraphType>>("validaCompletezzaRegistri")
            .Description("Ritorna lista di date per cui mancano registri cassa chiusi nel mese specificato")
            .Argument<NonNullGraphType<IntGraphType>>("anno", "Anno da validare")
            .Argument<NonNullGraphType<IntGraphType>>("mese", "Mese da validare (1-12)")
            .ResolveAsync(async context =>
            {
                var service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int anno = context.GetArgument<int>("anno");
                int mese = context.GetArgument<int>("mese");

                var giorniMancanti = await service.ValidaCompletezzaRegistriAsync(anno, mese);
                return giorniMancanti;
            });
    }
}

