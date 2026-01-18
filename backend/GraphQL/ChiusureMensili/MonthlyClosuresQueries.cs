using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.ChiusureMensili.Types;

namespace duedgusto.GraphQL.ChiusureMensili;

public class MonthlyClosuresQueries : ObjectGraphType
{
    public MonthlyClosuresQueries()
    {
        this.Authorize();

        // Get monthly closure by ID
        Field<ChiusuraMensileType, ChiusuraMensile>("chiusuraMensile")
            .Argument<NonNullGraphType<IntGraphType>>("chiusuraId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int closureId = context.GetArgument<int>("chiusuraId");

                var result = await dbContext.ChiusureMensili
                    .Include(c => c.ChiusaDaUtente)
                    .Include(c => c.Spese)
                        .ThenInclude(s => s.Pagamento)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == closureId);

                return result;
            });

        // Get all monthly closures, optionally filtered by year
        Field<ListGraphType<ChiusuraMensileType>, IEnumerable<ChiusuraMensile>>("chiusureMensili")
            .Argument<IntGraphType>("anno")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int? year = context.GetArgument<int?>("anno");

                IQueryable<ChiusuraMensile> query = dbContext.ChiusureMensili;

                if (year.HasValue)
                {
                    query = query.Where(c => c.Anno == year.Value);
                }

                return await query
                    .Include(c => c.ChiusaDaUtente)
                    .Include(c => c.Spese)
                        .ThenInclude(s => s.Pagamento)
                    .ToListAsync();
            });
    }
}

