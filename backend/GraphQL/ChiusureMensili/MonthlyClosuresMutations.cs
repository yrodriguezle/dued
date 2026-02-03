using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.GraphQL.ChiusureMensili.Types;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.MonthlyClosures;

public class MonthlyClosuresMutations : ObjectGraphType
{
    public MonthlyClosuresMutations()
    {
        this.Authorize();

        // ✅ NUOVE MUTATIONS (modello referenziale puro con ChiusuraMensileService)

        // Crea chiusura mensile con validazione completezza registri
        Field<ChiusuraMensileType>("creaChiusuraMensile")
            .Description("Crea una nuova chiusura mensile con validazione automatica completezza registri")
            .Argument<NonNullGraphType<IntGraphType>>("anno", "Anno della chiusura (es. 2026)")
            .Argument<NonNullGraphType<IntGraphType>>("mese", "Mese della chiusura (1-12)")
            .ResolveAsync(async context =>
            {
                var service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int anno = context.GetArgument<int>("anno");
                int mese = context.GetArgument<int>("mese");

                try
                {
                    var chiusura = await service.CreaChiusuraAsync(anno, mese);
                    return chiusura;
                }
                catch (InvalidOperationException ex)
                {
                    throw new ExecutionError(ex.Message);
                }
            });

        // Aggiungi spesa libera a chiusura
        Field<SpesaMensileTyperaType>("aggiungiSpesaLibera")
            .Description("Aggiunge una spesa libera (affitto, utenze, stipendi) alla chiusura mensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId", "ID della chiusura")
            .Argument<NonNullGraphType<StringGraphType>>("descrizione", "Descrizione della spesa")
            .Argument<NonNullGraphType<DecimalGraphType>>("importo", "Importo della spesa")
            .Argument<NonNullGraphType<StringGraphType>>("categoria", "Categoria: Affitto, Utenze, Stipendi, Altro")
            .ResolveAsync(async context =>
            {
                var service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int chiusuraId = context.GetArgument<int>("chiusuraId");
                string descrizione = context.GetArgument<string>("descrizione");
                decimal importo = context.GetArgument<decimal>("importo");
                string categoriaStr = context.GetArgument<string>("categoria");

                // Parse categoria enum
                if (!Enum.TryParse<CategoriaSpesa>(categoriaStr, ignoreCase: true, out var categoria))
                {
                    throw new ExecutionError($"Categoria non valida: {categoriaStr}. Valori accettati: Affitto, Utenze, Stipendi, Altro");
                }

                try
                {
                    var spesa = await service.AggiungiSpesaLiberaAsync(chiusuraId, descrizione, importo, categoria);
                    return spesa;
                }
                catch (Exception ex)
                {
                    throw new ExecutionError(ex.Message);
                }
            });

        // Includi pagamento fornitore in chiusura
        Field<BooleanGraphType>("includiPagamentoFornitore")
            .Description("Associa un pagamento fornitore alla chiusura mensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId", "ID della chiusura")
            .Argument<NonNullGraphType<IntGraphType>>("pagamentoId", "ID del pagamento fornitore")
            .ResolveAsync(async context =>
            {
                var service = GraphQLService.GetService<ChiusuraMensileService>(context);
                int chiusuraId = context.GetArgument<int>("chiusuraId");
                int pagamentoId = context.GetArgument<int>("pagamentoId");

                try
                {
                    return await service.IncludiPagamentoFornitoreAsync(chiusuraId, pagamentoId);
                }
                catch (Exception ex)
                {
                    throw new ExecutionError(ex.Message);
                }
            });

        // 🔄 MIGRAZIONE DATI (eseguire una sola volta)
        Field<StringGraphType>("migraChiusureMensiliVecchioModello")
            .Description("Migra tutte le chiusure esistenti dal vecchio modello denormalizzato al nuovo modello referenziale. ATTENZIONE: Eseguire una sola volta!")
            .ResolveAsync(async context =>
            {
                var migrazioneService = GraphQLService.GetService<MigrazioneChiusureMensiliService>(context);

                try
                {
                    var result = await migrazioneService.MigraDatiAsync();
                    var report = migrazioneService.GeneraReportMigrazione(result);
                    return report;
                }
                catch (Exception ex)
                {
                    throw new ExecutionError($"Errore durante migrazione: {ex.Message}");
                }
            });


        // Close Monthly Closure (change status to CHIUSA) - AGGIORNATA per usare service
        Field<ChiusuraMensileType>("chiudiChiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                var service = GraphQLService.GetService<ChiusuraMensileService>(context);
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
                    var chiusura = await service.GetChiusuraConRelazioniAsync(chiusuraId);
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

                var closure = await dbContext.ChiusureMensili
                    .Include(c => c.SpeseLibere)
                    .Include(c => c.PagamentiInclusi)
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
