using GraphQL;
using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.GraphQL.Sales;

using duedgusto.GraphQL.Sales.Types;

public class SalesQueries : ObjectGraphType
{
    public SalesQueries(AppDbContext dbContext)
    {
        Name = "SalesQuery";

        // Get all products (paginated)
        Field<ListGraphType<ProductType>>("products")
            .Argument<StringGraphType>("search", "Termine di ricerca")
            .Argument<StringGraphType>("category", "Categoria prodotto")
            .Argument<IntGraphType>("limit", "Limite risultati", configure: arg => arg.DefaultValue = 100)
            .Argument<IntGraphType>("offset", "Offset paginazione", configure: arg => arg.DefaultValue = 0)
            .ResolveAsync(async context =>
            {
                var search = context.GetArgument<string?>("search");
                var category = context.GetArgument<string?>("category");
                var limit = context.GetArgument<int>("limit");
                var offset = context.GetArgument<int>("offset");

                var query = dbContext.Products.Where(p => p.IsActive);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchTerm = search.ToLower();
                    query = query.Where(p =>
                        p.Code.ToLower().Contains(searchTerm) ||
                        p.Name.ToLower().Contains(searchTerm)
                    );
                }

                if (!string.IsNullOrWhiteSpace(category))
                {
                    query = query.Where(p => p.Category == category);
                }

                return await query
                    .OrderBy(p => p.Code)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            });

        // Get single product
        Field<ProductType>("product")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID prodotto")
            .ResolveAsync(async context =>
            {
                var id = context.GetArgument<int>("id");
                return await dbContext.Products
                    .FirstOrDefaultAsync(p => p.ProductId == id);
            });

        // Get sales by register
        Field<ListGraphType<SaleType>>("sales")
            .Argument<NonNullGraphType<IntGraphType>>("registerId", "ID registro cassa")
            .Argument<DateTimeGraphType>("dateFrom", "Data inizio")
            .Argument<DateTimeGraphType>("dateTo", "Data fine")
            .Argument<IntGraphType>("limit", "Limite risultati", configure: arg => arg.DefaultValue = 100)
            .Argument<IntGraphType>("offset", "Offset paginazione", configure: arg => arg.DefaultValue = 0)
            .ResolveAsync(async context =>
            {
                var registerId = context.GetArgument<int>("registerId");
                var dateFrom = context.GetArgument<DateTime?>("dateFrom");
                var dateTo = context.GetArgument<DateTime?>("dateTo");
                var limit = context.GetArgument<int>("limit");
                var offset = context.GetArgument<int>("offset");

                var query = dbContext.Sales
                    .Where(s => s.RegistroCassaId == registerId)
                    .Include(s => s.Product)
                    .AsQueryable();

                if (dateFrom.HasValue)
                {
                    query = query.Where(s => s.Timestamp >= dateFrom.Value);
                }

                if (dateTo.HasValue)
                {
                    query = query.Where(s => s.Timestamp <= dateTo.Value.AddDays(1));
                }

                return await query
                    .OrderByDescending(s => s.Timestamp)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            });

        // Get single sale
        Field<SaleType>("sale")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID vendita")
            .ResolveAsync(async context =>
            {
                var id = context.GetArgument<int>("id");
                return await dbContext.Sales
                    .Include(s => s.Product)
                    .FirstOrDefaultAsync(s => s.SaleId == id);
            });

        // Get product categories
        Field<ListGraphType<StringGraphType>>("productCategories")
            .ResolveAsync(async context =>
            {
                return await dbContext.Products
                    .Where(p => p.IsActive && p.Category != null)
                    .Select(p => p.Category)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToListAsync();
            });
    }
}
