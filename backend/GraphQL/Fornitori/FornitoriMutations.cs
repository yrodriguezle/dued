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
                FornitoreOrchestrator orchestrator = GraphQLService.GetService<FornitoreOrchestrator>(context);
                FornitoreInput input = context.GetArgument<FornitoreInput>("fornitore");
                return await orchestrator.MutateAsync(input);
            });

        Field<BooleanGraphType>("eliminaFornitore")
            .Argument<NonNullGraphType<IntGraphType>>("fornitoreId")
            .ResolveAsync(async context =>
            {
                FornitoreOrchestrator orchestrator = GraphQLService.GetService<FornitoreOrchestrator>(context);
                int fornitoreId = context.GetArgument<int>("fornitoreId");
                return await orchestrator.EliminaAsync(fornitoreId);
            });

        // === Fattura Acquisto ===

        Field<FatturaAcquistoType>("mutateFatturaAcquisto")
            .Argument<NonNullGraphType<FatturaAcquistoInputType>>("fattura", "Dati fattura acquisto")
            .ResolveAsync(async context =>
            {
                FatturaAcquistoOrchestrator orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
                FatturaAcquistoInput input = context.GetArgument<FatturaAcquistoInput>("fattura");
                return await orchestrator.MutateAsync(input);
            });

        Field<BooleanGraphType>("eliminaFatturaAcquisto")
            .Argument<NonNullGraphType<IntGraphType>>("fatturaId")
            .ResolveAsync(async context =>
            {
                FatturaAcquistoOrchestrator orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
                int fatturaId = context.GetArgument<int>("fatturaId");
                return await orchestrator.EliminaAsync(fatturaId);
            });

        // === Associazione DDT ===

        Field<FatturaAcquistoType>("associaDdtAFattura")
            .Argument<NonNullGraphType<IntGraphType>>("fatturaId", "ID fattura acquisto")
            .Argument<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("ddtIds", "Lista ID DDT da associare")
            .ResolveAsync(async context =>
            {
                FatturaAcquistoOrchestrator orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
                int fatturaId = context.GetArgument<int>("fatturaId");
                List<int> ddtIds = context.GetArgument<List<int>>("ddtIds");
                return await orchestrator.AssociaDdtAsync(fatturaId, ddtIds);
            });

        Field<FatturaAcquistoType>("disassociaDdtDaFattura")
            .Argument<NonNullGraphType<IntGraphType>>("fatturaId", "ID fattura acquisto")
            .Argument<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("ddtIds", "Lista ID DDT da disassociare")
            .ResolveAsync(async context =>
            {
                FatturaAcquistoOrchestrator orchestrator = GraphQLService.GetService<FatturaAcquistoOrchestrator>(context);
                int fatturaId = context.GetArgument<int>("fatturaId");
                List<int> ddtIds = context.GetArgument<List<int>>("ddtIds");
                return await orchestrator.DisassociaDdtAsync(fatturaId, ddtIds);
            });

        // === Documento di Trasporto ===

        Field<DocumentoTrasportoType>("mutateDocumentoTrasporto")
            .Argument<NonNullGraphType<DocumentoTrasportoInputType>>("documentoTrasporto", "Dati documento di trasporto")
            .ResolveAsync(async context =>
            {
                DocumentoTrasportoOrchestrator orchestrator = GraphQLService.GetService<DocumentoTrasportoOrchestrator>(context);
                DocumentoTrasportoInput input = context.GetArgument<DocumentoTrasportoInput>("documentoTrasporto");
                return await orchestrator.MutateAsync(input);
            });

        Field<BooleanGraphType>("eliminaDocumentoTrasporto")
            .Argument<NonNullGraphType<IntGraphType>>("ddtId")
            .ResolveAsync(async context =>
            {
                DocumentoTrasportoOrchestrator orchestrator = GraphQLService.GetService<DocumentoTrasportoOrchestrator>(context);
                int ddtId = context.GetArgument<int>("ddtId");
                return await orchestrator.EliminaAsync(ddtId);
            });

        // === Pagamento Fornitore ===

        Field<PagamentoFornitoreType>("mutatePagamentoFornitore")
            .Argument<NonNullGraphType<PagamentoFornitoreInputType>>("pagamento", "Dati pagamento fornitore")
            .ResolveAsync(async context =>
            {
                PagamentoFornitoreOrchestrator orchestrator = GraphQLService.GetService<PagamentoFornitoreOrchestrator>(context);
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                PagamentoFornitoreInput input = context.GetArgument<PagamentoFornitoreInput>("pagamento");

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
                PagamentoFornitoreOrchestrator orchestrator = GraphQLService.GetService<PagamentoFornitoreOrchestrator>(context);
                int pagamentoId = context.GetArgument<int>("pagamentoId");
                return await orchestrator.EliminaAsync(pagamentoId);
            });
    }
}
