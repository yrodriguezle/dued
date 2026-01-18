using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.MonthlyClosures.Types;

namespace duedgusto.GraphQL.MonthlyClosures;

public class MonthlyClosuresQueries : ObjectGraphType
{
    public MonthlyClosuresQueries()
    {
        this.Authorize();

        // Get monthly closure by ID
        Field<MonthlyClosureType, ChiusuraMensile>("monthlyClosure")
            .Argument<NonNullGraphType<IntGraphType>>("closureId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int closureId = context.GetArgument<int>("closureId");

                var result = await dbContext.ChiusureMensili
                    .Include(c => c.ChiusaDaUtente)
                    .Include(c => c.Spese)
                        .ThenInclude(s => s.Pagamento)
                    .FirstOrDefaultAsync(c => c.ChiusuraId == closureId);

                return result;
            });

        // Get all monthly closures, optionally filtered by year
        Field<ListGraphType<MonthlyClosureType>, IEnumerable<ChiusuraMensile>>("monthlyClosures")
            .Argument<IntGraphType>("year")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int? year = context.GetArgument<int?>("year");

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
