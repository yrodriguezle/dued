using GraphQL;
using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.Sales;

using duedgusto.GraphQL.Sales.Types;

public class SalesMutations : ObjectGraphType
{
    public SalesMutations(AppDbContext dbContext)
    {
        Name = "SalesMutation";

        // Create sale
        Field<SaleType>(
            "createSale",
            arguments: new QueryArguments(
                new QueryArgument<NonNullGraphType<CreateSaleInputType>> { Name = "input" }
            ),
            resolve: context => CreateSaleAsync(context, dbContext)
        );

        // Update sale
        Field<SaleType>(
            "updateSale",
            arguments: new QueryArguments(
                new QueryArgument<NonNullGraphType<IntGraphType>> { Name = "id" },
                new QueryArgument<NonNullGraphType<UpdateSaleInputType>> { Name = "input" }
            ),
            resolve: context => UpdateSaleAsync(context, dbContext)
        );

        // Delete sale
        Field<BooleanGraphType>(
            "deleteSale",
            arguments: new QueryArguments(
                new QueryArgument<NonNullGraphType<IntGraphType>> { Name = "id" }
            ),
            resolve: context => DeleteSaleAsync(context, dbContext)
        );
    }

    private static async Task<Sale> CreateSaleAsync(IResolveFieldContext context, AppDbContext dbContext)
    {
        var input = context.GetArgument<CreateSaleInput>("input");

        // Verify product exists
        var product = await dbContext.Products
            .FirstOrDefaultAsync(p => p.ProductId == input.ProductId);

        if (product == null)
        {
            throw new InvalidOperationException("Prodotto non trovato");
        }

        // Verify register exists
        var register = await dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == input.RegisterId);

        if (register == null)
        {
            throw new InvalidOperationException("Cassa non trovata");
        }

        // Guard: verifica che il registro non appartenga a un mese chiuso
        var chiusuraService = context.RequestServices!.CreateScope().ServiceProvider.GetRequiredService<ChiusuraMensileService>();
        if (await chiusuraService.DataAppartieneAMeseChiusoAsync(register.Data))
        {
            throw new InvalidOperationException(
                $"Impossibile creare vendite: il mese {register.Data:MM/yyyy} è chiuso.");
        }

        // Create sale
        var sale = new Sale
        {
            RegistroCassaId = input.RegisterId,
            ProductId = input.ProductId,
            Quantity = input.Quantity,
            UnitPrice = product.Price,
            TotalPrice = input.Quantity * product.Price,
            Notes = input.Notes,
            Timestamp = input.Timestamp ?? DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.Sales.Add(sale);

        // Update register VenditeContanti total
        register.VenditeContanti += sale.TotalPrice;
        register.TotaleVendite = register.VenditeContanti + register.IncassiElettronici;
        register.AggiornatoIl = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        // Reload product for response
        sale.Product = product;

        return sale;
    }

    private static async Task<Sale> UpdateSaleAsync(IResolveFieldContext context, AppDbContext dbContext)
    {
        var id = context.GetArgument<int>("id");
        var input = context.GetArgument<UpdateSaleInput>("input");

        var sale = await dbContext.Sales
            .Include(s => s.Product)
            .FirstOrDefaultAsync(s => s.SaleId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        var chiusuraServiceUpdate = context.RequestServices!.CreateScope().ServiceProvider.GetRequiredService<ChiusuraMensileService>();
        if (await chiusuraServiceUpdate.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile modificare vendite: il mese corrispondente è chiuso.");
        }

        // Verify product if changed
        if (input.ProductId.HasValue && input.ProductId.Value != sale.ProductId)
        {
            var product = await dbContext.Products
                .FirstOrDefaultAsync(p => p.ProductId == input.ProductId.Value);

            if (product == null)
            {
                throw new InvalidOperationException("Prodotto non trovato");
            }

            sale.ProductId = product.ProductId;
            sale.UnitPrice = product.Price;
            sale.Product = product;
        }

        if (input.Quantity.HasValue)
        {
            sale.Quantity = input.Quantity.Value;
        }

        if (input.Notes != null)
        {
            sale.Notes = input.Notes;
        }

        sale.TotalPrice = sale.Quantity * sale.UnitPrice;
        sale.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return sale;
    }

    private static async Task<bool> DeleteSaleAsync(IResolveFieldContext context, AppDbContext dbContext)
    {
        var id = context.GetArgument<int>("id");

        var sale = await dbContext.Sales
            .FirstOrDefaultAsync(s => s.SaleId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        var chiusuraServiceDelete = context.RequestServices!.CreateScope().ServiceProvider.GetRequiredService<ChiusuraMensileService>();
        if (await chiusuraServiceDelete.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile eliminare vendite: il mese corrispondente è chiuso.");
        }

        // Update register VenditeContanti total
        var register = await dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == sale.RegistroCassaId);

        if (register != null)
        {
            register.VenditeContanti -= sale.TotalPrice;
            register.TotaleVendite = register.VenditeContanti + register.IncassiElettronici;
            register.AggiornatoIl = DateTime.UtcNow;
        }

        dbContext.Sales.Remove(sale);
        await dbContext.SaveChangesAsync();

        return true;
    }
}


