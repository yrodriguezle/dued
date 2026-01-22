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
        Field<ListGraphType<ProductType>>(
            "products",
            arguments: new QueryArguments(
                new QueryArgument<StringGraphType> { Name = "search" },
                new QueryArgument<StringGraphType> { Name = "category" },
                new QueryArgument<IntGraphType> { Name = "limit", DefaultValue = 100 },
                new QueryArgument<IntGraphType> { Name = "offset", DefaultValue = 0 }
            ),
            resolve: context =>
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

                return query
                    .OrderBy(p => p.Code)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            }
        );

        // Get single product
        Field<ProductType>(
            "product",
            arguments: new QueryArguments(
                new QueryArgument<NonNullGraphType<IntGraphType>> { Name = "id" }
            ),
            resolve: context =>
            {
                var id = context.GetArgument<int>("id");
                return dbContext.Products
                    .FirstOrDefaultAsync(p => p.ProductId == id);
            }
        );

        // Get sales by register
        Field<ListGraphType<SaleType>>(
            "sales",
            arguments: new QueryArguments(
                new QueryArgument<NonNullGraphType<IntGraphType>> { Name = "registerId" },
                new QueryArgument<DateTimeGraphType> { Name = "dateFrom" },
                new QueryArgument<DateTimeGraphType> { Name = "dateTo" },
                new QueryArgument<IntGraphType> { Name = "limit", DefaultValue = 100 },
                new QueryArgument<IntGraphType> { Name = "offset", DefaultValue = 0 }
            ),
            resolve: context =>
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

                return query
                    .OrderByDescending(s => s.Timestamp)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            }
        );

        // Get single sale
        Field<SaleType>(
            "sale",
            arguments: new QueryArguments(
                new QueryArgument<NonNullGraphType<IntGraphType>> { Name = "id" }
            ),
            resolve: context =>
            {
                var id = context.GetArgument<int>("id");
                return dbContext.Sales
                    .Include(s => s.Product)
                    .FirstOrDefaultAsync(s => s.SaleId == id);
            }
        );

        // Get product categories
        Field<ListGraphType<StringGraphType>>(
            "productCategories",
            resolve: context =>
            {
                return dbContext.Products
                    .Where(p => p.IsActive && p.Category != null)
                    .Select(p => p.Category)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToListAsync();
            }
        );
    }
}
