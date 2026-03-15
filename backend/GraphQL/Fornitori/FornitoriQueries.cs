using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.Connection;

namespace duedgusto.GraphQL.Fornitori;

public class FornitoriQueries : ObjectGraphType
{
    public FornitoriQueries()
    {
        this.Authorize();

        // Tutti i fornitori
        Field<ListGraphType<FornitoreType>, List<Fornitore>>("fornitori")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Fornitori
                    .Where(s => s.Attivo)
                    .OrderBy(s => s.RagioneSociale)
                    .ToListAsync();
            });

        // Singolo fornitore per ID
        Field<FornitoreType, Fornitore>("fornitore")
            .Argument<NonNullGraphType<IntGraphType>>("fornitoreId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int fornitoreId = context.GetArgument<int>("fornitoreId");

                var result = await dbContext.Fornitori
                    .Include(s => s.FattureAcquisto)
                    .Include(s => s.DocumentiTrasporto)
                    .FirstOrDefaultAsync(s => s.FornitoreId == fornitoreId);

                return result;
            });

        // Fattura acquisto per ID
        Field<FatturaAcquistoType, FatturaAcquisto>("fatturaAcquisto")
            .Argument<NonNullGraphType<IntGraphType>>("fatturaId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int fatturaId = context.GetArgument<int>("fatturaId");

                var result = await dbContext.FattureAcquisto
                    .Include(i => i.Fornitore)
                    .Include(i => i.DocumentiTrasporto)
                    .Include(i => i.Pagamenti)
                    .FirstOrDefaultAsync(i => i.FatturaId == fatturaId);

                return result;
            });

        // Documento di trasporto per ID
        Field<DocumentoTrasportoType, DocumentoTrasporto>("documentoTrasporto")
            .Argument<NonNullGraphType<IntGraphType>>("ddtId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int ddtId = context.GetArgument<int>("ddtId");

                var result = await dbContext.DocumentiTrasporto
                    .Include(d => d.Fornitore)
                    .Include(d => d.Fattura)
                    .Include(d => d.Pagamenti)
                    .FirstOrDefaultAsync(d => d.DdtId == ddtId);

                return result;
            });
    }
}
