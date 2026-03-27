using GraphQL;
using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Services.GraphQL;
using duedgusto.Services.Jwt;

namespace duedgusto.GraphQL.Fornitori;

public class FornitoriMutations : ObjectGraphType
{
    public FornitoriMutations()
    {
        this.Authorize();

        // === Fornitore ===

        Field<FornitoreType>("mutateFornitore")
            .Argument<NonNullGraphType<FornitoreInputType>>("fornitore", "Dati fornitore")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<FornitoreOrchestrator>(context);
                var input = context.GetArgument<FornitoreInput>("fornitore");
                return await orchestrator.MutateAsync(input);
            });

        Field<BooleanGraphType>("eliminaFornitore")
            .Argument<NonNullGraphType<IntGraphType>>("fornitoreId")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<FornitoreOrchestrator>(context);
                int fornitoreId = context.GetArgument<int>("fornitoreId");
                return await orchestrator.EliminaAsync(fornitoreId);
            });

        // === Fattura Acquisto ===

        Field<FatturaAcquistoType>("mutateFatturaAcquisto")
            .Argument<NonNullGraphType<FatturaAcquistoInputType>>("fattura", "Dati fattura acquisto")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
                var input = context.GetArgument<FatturaAcquistoInput>("fattura");
                return await orchestrator.MutateAsync(input);
            });

        Field<BooleanGraphType>("eliminaFatturaAcquisto")
            .Argument<NonNullGraphType<IntGraphType>>("fatturaId")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
                int fatturaId = context.GetArgument<int>("fatturaId");
                return await orchestrator.EliminaAsync(fatturaId);
            });

        // === Documento di Trasporto ===

        Field<DocumentoTrasportoType>("mutateDocumentoTrasporto")
            .Argument<NonNullGraphType<DocumentoTrasportoInputType>>("documentoTrasporto", "Dati documento di trasporto")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<DocumentoTrasportoOrchestrator>(context);
                var input = context.GetArgument<DocumentoTrasportoInput>("documentoTrasporto");
                return await orchestrator.MutateAsync(input);
            });

        Field<BooleanGraphType>("eliminaDocumentoTrasporto")
            .Argument<NonNullGraphType<IntGraphType>>("ddtId")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<DocumentoTrasportoOrchestrator>(context);
                int ddtId = context.GetArgument<int>("ddtId");
                return await orchestrator.EliminaAsync(ddtId);
            });

        // === Pagamento Fornitore ===

        Field<PagamentoFornitoreType>("mutatePagamentoFornitore")
            .Argument<NonNullGraphType<PagamentoFornitoreInputType>>("pagamento", "Dati pagamento fornitore")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<PagamentoFornitoreOrchestrator>(context);
                var jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                var input = context.GetArgument<PagamentoFornitoreInput>("pagamento");

                var userContext = context.UserContext as GraphQLUserContext;
                int utenteId = userContext?.Principal != null
                    ? jwtHelper.GetUserID(userContext.Principal)
                    : 1;

                return await orchestrator.MutateAsync(input, utenteId);
            });

        Field<BooleanGraphType>("eliminaPagamentoFornitore")
            .Argument<NonNullGraphType<IntGraphType>>("pagamentoId")
            .ResolveAsync(async context =>
            {
                var orchestrator = GraphQLService.GetService<PagamentoFornitoreOrchestrator>(context);
                int pagamentoId = context.GetArgument<int>("pagamentoId");
                return await orchestrator.EliminaAsync(pagamentoId);
            });
    }
}
