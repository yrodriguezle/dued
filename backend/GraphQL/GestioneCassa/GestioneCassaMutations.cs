using GraphQL;
using GraphQL.Types;

using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.Services.GraphQL;

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
                var orchestrator = GraphQLService.GetService<MutateRegistroCassaOrchestrator>(context);
                var input = context.GetArgument<RegistroCassaInput>("registroCassa");
                return await orchestrator.ExecuteAsync(input);
            });

        Field<RegistroCassaType>("chiudiRegistroCassa")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<ChiudiRegistroCassaOrchestrator>(context);
                int registroCassaId = context.GetArgument<int>("registroCassaId");
                return await orchestrator.ExecuteAsync(registroCassaId);
            });

        Field<BooleanGraphType>("eliminaRegistroCassa")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<EliminaRegistroCassaOrchestrator>(context);
                int registroCassaId = context.GetArgument<int>("registroCassaId");
                return await orchestrator.ExecuteAsync(registroCassaId);
            });
    }
}
