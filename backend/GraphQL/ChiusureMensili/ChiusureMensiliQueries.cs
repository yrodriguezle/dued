using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.GraphQL.ChiusureMensili.Types;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.ChiusureMensili;

public class ChiusureMensiliQueries : ObjectGraphType
{
    public ChiusureMensiliQueries()
    {
        this.Authorize();

        // Get monthly closure by ID - AGGIORNATA per includere nuove relazioni
        Field<ChiusuraMensileType, ChiusuraMensile>("chiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                ChiusuraMensileService service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int closureId = context.GetArgument<int>("chiusuraId");

                // Usa il service che carica tutte le relazioni necessarie
                ChiusuraMensile? result = await service.GetChiusuraConRelazioniAsync(closureId);
                return result;
            });

        // Get all monthly closures, optionally filtered by year.
        // Passa dal service perché le bozze vanno riallineate ai registri del mese prima di
        // esporre le proprietà calcolate.
        Field<ListGraphType<ChiusuraMensileType>, IEnumerable<ChiusuraMensile>>("chiusureMensili")
            .Argument<IntGraphType>("anno")
            .ResolveAsync(async context =>
            {
                ChiusuraMensileService service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int? year = context.GetArgument<int?>("anno");

                return await service.GetChiusureAsync(year);
            });

        // NUOVA QUERY: Valida completezza registri per un mese
        Field<ListGraphType<DateTimeGraphType>>("validaCompletezzaRegistri")
            .Description("Ritorna lista di date per cui mancano registri cassa chiusi nel mese specificato")
            .Argument<NonNullGraphType<IntGraphType>>("anno", "Anno da validare")
            .Argument<NonNullGraphType<IntGraphType>>("mese", "Mese da validare (1-12)")
            .ResolveAsync(async context =>
            {
                ChiusuraMensileService service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int anno = context.GetArgument<int>("anno");
                int mese = context.GetArgument<int>("mese");

                List<DateTime> giorniMancanti = await service.ValidaCompletezzaRegistriAsync(anno, mese);
                return giorniMancanti;
            });
    }
}
