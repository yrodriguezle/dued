using GraphQL;
using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.Services.GraphQL;
using duedgusto.Services.Jwt;

namespace duedgusto.GraphQL.GestioneCassa;

public class GestioneCassaMutations : ObjectGraphType
{
    public GestioneCassaMutations()
    {
        this.Authorize();

        Field<RegistroCassaType>("mutateRegistroCassa")
            .Argument<NonNullGraphType<RegistroCassaInputType>>("registroCassa", "Dati registro cassa")
            .ResolveAsync(async context =>
            {
                MutateRegistroCassaOrchestrator orchestrator = GraphQLService.GetService<MutateRegistroCassaOrchestrator>(context);
                RegistroCassaInput input = context.GetArgument<RegistroCassaInput>("registroCassa");
                return await orchestrator.ExecuteAsync(input);
            });

        Field<RegistroCassaType>("aggiungiSpesaSuGiorno")
            .Argument<NonNullGraphType<AggiungiSpesaSuGiornoInputType>>("input", "Spesa fissa da registrare su un giorno (registro leggero)")
            .ResolveAsync(async context =>
            {
                AggiungiSpesaSuGiornoOrchestrator orchestrator = GraphQLService.GetService<AggiungiSpesaSuGiornoOrchestrator>(context);
                AggiungiSpesaSuGiornoInput input = context.GetArgument<AggiungiSpesaSuGiornoInput>("input");
                return await orchestrator.ExecuteAsync(input);
            });

        Field<RegistroCassaType>("chiudiRegistroCassa")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId")
            .ResolveAsync(async context =>
            {
                ChiudiRegistroCassaOrchestrator orchestrator = GraphQLService.GetService<ChiudiRegistroCassaOrchestrator>(context);
                int registroCassaId = context.GetArgument<int>("registroCassaId");
                return await orchestrator.ExecuteAsync(registroCassaId);
            });

        Field<BooleanGraphType>("eliminaRegistroCassa")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId")
            .ResolveAsync(async context =>
            {
                EliminaRegistroCassaOrchestrator orchestrator = GraphQLService.GetService<EliminaRegistroCassaOrchestrator>(context);
                int registroCassaId = context.GetArgument<int>("registroCassaId");
                return await orchestrator.ExecuteAsync(registroCassaId);
            });

        // ─────────────────────────────────────────────────────────────
        // CRUD granulare per-riga SpesaCassa sul registro del giorno
        // ─────────────────────────────────────────────────────────────

        Field<SpesaCassaType>("aggiungiSpesaCassaSuGiorno")
            .Argument<NonNullGraphType<AggiungiSpesaCassaSuGiornoInputType>>("input", "SpesaCassa da creare sul registro del giorno")
            .ResolveAsync(async context =>
            {
                SpesaCassaSuGiornoOrchestrator orchestrator = GraphQLService.GetService<SpesaCassaSuGiornoOrchestrator>(context);
                AggiungiSpesaCassaSuGiornoInput input = context.GetArgument<AggiungiSpesaCassaSuGiornoInput>("input");
                return await orchestrator.AggiungiAsync(input, GetUtenteId(context));
            });

        Field<SpesaCassaType>("aggiornaSpesaCassaSuGiorno")
            .Argument<NonNullGraphType<AggiornaSpesaCassaSuGiornoInputType>>("input", "SpesaCassa da aggiornare (con eventuale cambio data)")
            .ResolveAsync(async context =>
            {
                SpesaCassaSuGiornoOrchestrator orchestrator = GraphQLService.GetService<SpesaCassaSuGiornoOrchestrator>(context);
                AggiornaSpesaCassaSuGiornoInput input = context.GetArgument<AggiornaSpesaCassaSuGiornoInput>("input");
                return await orchestrator.AggiornaAsync(input, GetUtenteId(context));
            });

        Field<BooleanGraphType>("eliminaSpesaCassaSuGiorno")
            .Argument<NonNullGraphType<IntGraphType>>("spesaId")
            .ResolveAsync(async context =>
            {
                SpesaCassaSuGiornoOrchestrator orchestrator = GraphQLService.GetService<SpesaCassaSuGiornoOrchestrator>(context);
                int spesaId = context.GetArgument<int>("spesaId");
                return await orchestrator.EliminaAsync(spesaId);
            });

        // ─────────────────────────────────────────────────────────────
        // CRUD granulare per-riga PagamentoFornitore sul registro del giorno
        // ─────────────────────────────────────────────────────────────

        Field<PagamentoFornitoreType>("aggiungiPagamentoFornitoreSuGiorno")
            .Argument<NonNullGraphType<AggiungiPagamentoFornitoreSuGiornoInputType>>("input", "PagamentoFornitore da creare sul registro del giorno (fattura opzionale)")
            .ResolveAsync(async context =>
            {
                PagamentoFornitoreSuGiornoOrchestrator orchestrator = GraphQLService.GetService<PagamentoFornitoreSuGiornoOrchestrator>(context);
                AggiungiPagamentoFornitoreSuGiornoInput input = context.GetArgument<AggiungiPagamentoFornitoreSuGiornoInput>("input");
                return await orchestrator.AggiungiAsync(input, GetUtenteId(context));
            });

        Field<PagamentoFornitoreType>("aggiornaPagamentoFornitoreSuGiorno")
            .Argument<NonNullGraphType<PagamentoFornitoreInputType>>("input", "PagamentoFornitore da aggiornare (con eventuale cambio data)")
            .ResolveAsync(async context =>
            {
                PagamentoFornitoreSuGiornoOrchestrator orchestrator = GraphQLService.GetService<PagamentoFornitoreSuGiornoOrchestrator>(context);
                PagamentoFornitoreInput input = context.GetArgument<PagamentoFornitoreInput>("input");
                return await orchestrator.AggiornaAsync(input, GetUtenteId(context));
            });

        Field<BooleanGraphType>("eliminaPagamentoFornitoreSuGiorno")
            .Argument<NonNullGraphType<IntGraphType>>("pagamentoId")
            .ResolveAsync(async context =>
            {
                PagamentoFornitoreSuGiornoOrchestrator orchestrator = GraphQLService.GetService<PagamentoFornitoreSuGiornoOrchestrator>(context);
                int pagamentoId = context.GetArgument<int>("pagamentoId");
                return await orchestrator.EliminaAsync(pagamentoId);
            });
    }

    private static int GetUtenteId(IResolveFieldContext<object?> context)
    {
        JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
        GraphQLUserContext userContext = context.UserContext as GraphQLUserContext
            ?? throw new ExecutionError("Utente non autenticato");
        return jwtHelper.GetUserID(userContext.Principal!);
    }
}
