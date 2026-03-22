using GraphQL;
using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Vendite;

using duedgusto.GraphQL.Vendite.Types;

public class VenditeQueries : ObjectGraphType
{
    public VenditeQueries()
    {
        Name = "VenditeQuery";

        // Get all products (paginated)
        Field<ListGraphType<ProdottoType>>("prodotti")
            .Argument<StringGraphType>("ricerca", "Termine di ricerca")
            .Argument<StringGraphType>("categoria", "Categoria prodotto")
            .Argument<IntGraphType>("limite", "Limite risultati", configure: arg => arg.DefaultValue = 100)
            .Argument<IntGraphType>("scostamento", "Offset paginazione", configure: arg => arg.DefaultValue = 0)
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var search = context.GetArgument<string?>("ricerca");
                var category = context.GetArgument<string?>("categoria");
                var limit = context.GetArgument<int>("limite");
                var offset = context.GetArgument<int>("scostamento");

                var query = dbContext.Prodotti.Where(p => p.Attivo);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchTerm = search.ToLower();
                    query = query.Where(p =>
                        p.Codice.ToLower().Contains(searchTerm) ||
                        p.Nome.ToLower().Contains(searchTerm)
                    );
                }

                if (!string.IsNullOrWhiteSpace(category))
                {
                    query = query.Where(p => p.Categoria == category);
                }

                return await query
                    .OrderBy(p => p.Codice)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            });

        // Get single product
        Field<ProdottoType>("prodotto")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID prodotto")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var id = context.GetArgument<int>("id");
                return await dbContext.Prodotti
                    .FirstOrDefaultAsync(p => p.ProdottoId == id);
            });

        // Get sales by register
        Field<ListGraphType<VenditaType>>("vendite")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId", "ID registro cassa")
            .Argument<DateTimeGraphType>("dataDa", "Data inizio")
            .Argument<DateTimeGraphType>("dataA", "Data fine")
            .Argument<IntGraphType>("limite", "Limite risultati", configure: arg => arg.DefaultValue = 100)
            .Argument<IntGraphType>("scostamento", "Offset paginazione", configure: arg => arg.DefaultValue = 0)
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var registerId = context.GetArgument<int>("registroCassaId");
                var dateFrom = context.GetArgument<DateTime?>("dataDa");
                var dateTo = context.GetArgument<DateTime?>("dataA");
                var limit = context.GetArgument<int>("limite");
                var offset = context.GetArgument<int>("scostamento");

                var query = dbContext.Vendite
                    .Where(s => s.RegistroCassaId == registerId)
                    .AsQueryable();

                if (dateFrom.HasValue)
                {
                    query = query.Where(s => s.DataOra >= dateFrom.Value);
                }

                if (dateTo.HasValue)
                {
                    query = query.Where(s => s.DataOra <= dateTo.Value.AddDays(1));
                }

                return await query
                    .OrderByDescending(s => s.DataOra)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            });

        // Get single sale
        Field<VenditaType>("vendita")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID vendita")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var id = context.GetArgument<int>("id");
                return await dbContext.Vendite
                    .FirstOrDefaultAsync(s => s.VenditaId == id);
            });

        // Get product categories
        Field<ListGraphType<StringGraphType>>("categorieProdotto")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Prodotti
                    .Where(p => p.Attivo && p.Categoria != null)
                    .Select(p => p.Categoria)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToListAsync();
            });
    }
}
