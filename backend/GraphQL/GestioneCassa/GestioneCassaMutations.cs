using GraphQL;
using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
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

        // Spese non tracciate riga per riga: usata dalla griglia spese della Chiusura Mensile,
        // che scrive su un giorno scelto dall'utente. Il registro viene creato se assente.
        Field<SpesaCassaType>("mutateSpesaCassa")
            .Argument<NonNullGraphType<SpesaCassaMutateInputType>>("spesa", "Spesa da creare o aggiornare")
            .ResolveAsync(async context =>
            {
                MutateSpesaCassaOrchestrator orchestrator = GraphQLService.GetService<MutateSpesaCassaOrchestrator>(context);
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                SpesaCassaMutateInput input = context.GetArgument<SpesaCassaMutateInput>("spesa");

                var userContext = context.UserContext as GraphQLUserContext
                    ?? throw new ExecutionError("Utente non autenticato");
                int utenteId = jwtHelper.GetUserID(userContext.Principal!);

                return await orchestrator.ExecuteAsync(input, utenteId);
            });

        Field<BooleanGraphType>("eliminaSpesaCassa")
            .Argument<NonNullGraphType<IntGraphType>>("spesaId")
            .ResolveAsync(async context =>
            {
                MutateSpesaCassaOrchestrator orchestrator = GraphQLService.GetService<MutateSpesaCassaOrchestrator>(context);
                int spesaId = context.GetArgument<int>("spesaId");
                return await orchestrator.EliminaAsync(spesaId);
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
    }
}
