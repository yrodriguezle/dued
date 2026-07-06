using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.GraphQL.ChiusureMensili.Types;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.ChiusureMensili;

public class ChiusureMensiliMutations : ObjectGraphType
{
    public ChiusureMensiliMutations()
    {
        this.Authorize();

        // Crea chiusura mensile con validazione completezza registri
        Field<ChiusuraMensileType>("creaChiusuraMensile")
            .Description("Crea una nuova chiusura mensile con validazione automatica completezza registri")
            .Argument<NonNullGraphType<IntGraphType>>("anno", "Anno della chiusura (es. 2026)")
            .Argument<NonNullGraphType<IntGraphType>>("mese", "Mese della chiusura (1-12)")
            .ResolveAsync(async context =>
            {
                ChiusuraMensileService service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int anno = context.GetArgument<int>("anno");
                int mese = context.GetArgument<int>("mese");

                try
                {
                    ChiusuraMensile chiusura = await service.CreaChiusuraAsync(anno, mese);
                    return chiusura;
                }
                catch (InvalidOperationException ex)
                {
                    throw new ExecutionError(ex.Message);
                }
            });

        // Aggiorna giorni esclusi dalla chiusura mensile
        Field<ChiusuraMensileType>("aggiornaGiorniEsclusi")
            .Description("Aggiorna i giorni esclusi dalla validazione della chiusura mensile (solo in stato BOZZA)")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId", "ID della chiusura")
            .Argument<NonNullGraphType<ListGraphType<NonNullGraphType<GiornoEsclusoInputType>>>>("giorniEsclusi", "Lista dei giorni da escludere")
            .ResolveAsync(async context =>
            {
                ChiusuraMensileService service = GraphQLService.GetService<ChiusuraMensileService>(context);
                var userContext = context.UserContext as GraphQLUserContext;
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                int chiusuraId = context.GetArgument<int>("chiusuraId");
                List<Dictionary<string, object>> inputGiorni = context.GetArgument<List<Dictionary<string, object>>>("giorniEsclusi");

                int? utenteId = null;
                if (userContext?.Principal != null)
                {
                    utenteId = jwtHelper.GetUserID(userContext.Principal);
                }

                var giorniEsclusi = inputGiorni.Select(g => new GiornoEscluso
                {
                    Data = Convert.ToDateTime(g["data"]),
                    CodiceMotivo = g["codiceMotivo"].ToString()!,
                    Note = g.ContainsKey("note") && g["note"] != null ? g["note"].ToString() : null,
                    DataEsclusione = DateTime.UtcNow,
                    UtenteEsclusione = utenteId ?? 0,
                }).ToList();

                try
                {
                    return await service.AggiornaGiorniEsclusiAsync(chiusuraId, giorniEsclusi);
                }
                catch (InvalidOperationException ex)
                {
                    throw new ExecutionError(ex.Message);
                }
            });

        // Close Monthly Closure (change status to CHIUSA) - AGGIORNATA per usare service
        Field<ChiusuraMensileType>("chiudiChiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                ChiusuraMensileService service = GraphQLService.GetService<ChiusuraMensileService>(context);
                var userContext = context.UserContext as GraphQLUserContext;
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                int chiusuraId = context.GetArgument<int>("chiusuraId");

                int? utenteId = null;
                if (userContext?.Principal != null)
                {
                    utenteId = jwtHelper.GetUserID(userContext.Principal);
                }

                try
                {
                    bool success = await service.ChiudiMensileAsync(chiusuraId, utenteId);
                    if (!success)
                    {
                        throw new ExecutionError($"Chiusura mensile con ID {chiusuraId} non trovata");
                    }

                    // Ricarica con relazioni per ritorno
                    ChiusuraMensile? chiusura = await service.GetChiusuraConRelazioniAsync(chiusuraId);
                    if (chiusura != null)
                    {
                        // Avvisi di completezza NON bloccanti (registri/pagamenti del mese non inclusi):
                        // ricalcolati sull'istanza ricaricata per esporli nel payload GraphQL.
                        chiusura.AvvisiCompletezza = await service.ValidaCompletezzaChiusuraWarningsAsync(chiusuraId);
                    }
                    return chiusura;
                }
                catch (InvalidOperationException ex)
                {
                    throw new ExecutionError(ex.Message);
                }
            });

        // Delete Monthly Closure
        Field<BooleanGraphType>("eliminaChiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int chiusuraId = context.GetArgument<int>("chiusuraId");

                ChiusuraMensile? closure = await dbContext.ChiusureMensili
                      .Include(c => c.RegistriInclusi)
                      .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

                if (closure == null)
                {
                    throw new ExecutionError($"Chiusura mensile con ID {chiusuraId} non trovata");
                }

                if (closure.Stato == "CHIUSA" || closure.Stato == "RICONCILIATA")
                {
                    throw new ExecutionError("Impossibile eliminare una chiusura chiusa o riconciliata.");
                }

                dbContext.ChiusureMensili.Remove(closure);
                await dbContext.SaveChangesAsync();

                return true;
            });
    }
}
