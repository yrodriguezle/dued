using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Suppliers.Types;
using duedgusto.GraphQL.Connection;

namespace duedgusto.GraphQL.Suppliers;

public class SuppliersQueries : ObjectGraphType
{
    public SuppliersQueries()
    {
        this.Authorize();

        // Get all suppliers
        Field<ListGraphType<SupplierType>, List<Fornitore>>("suppliers")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Fornitori
                    .Where(s => s.Attivo)
                    .OrderBy(s => s.RagioneSociale)
                    .ToListAsync();
            });

        // Get single supplier by ID
        Field<SupplierType, Fornitore>("supplier")
            .Argument<NonNullGraphType<IntGraphType>>("supplierId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int supplierId = context.GetArgument<int>("supplierId");

                var result = await dbContext.Fornitori
                    .Include(s => s.FattureAcquisto)
                    .Include(s => s.DocumentiTrasporto)
                    .FirstOrDefaultAsync(s => s.FornitoreId == supplierId);

                return result;
            });

        // Get purchase invoice by ID
        Field<PurchaseInvoiceType, FatturaAcquisto>("purchaseInvoice")
            .Argument<NonNullGraphType<IntGraphType>>("invoiceId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int invoiceId = context.GetArgument<int>("invoiceId");

                var result = await dbContext.FattureAcquisto
                    .Include(i => i.Fornitore)
                    .Include(i => i.DocumentiTrasporto)
                    .Include(i => i.Pagamenti)
                    .FirstOrDefaultAsync(i => i.FatturaId == invoiceId);

                return result;
            });

        // Get delivery note by ID
        Field<DeliveryNoteType, DocumentoTrasporto>("deliveryNote")
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
