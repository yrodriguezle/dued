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

        // Get monthly closure by year and month
        Field<MonthlyClosureType, ChiusuraMensile>("monthlyClosure")
            .Argument<NonNullGraphType<IntGraphType>>("year")
            .Argument<NonNullGraphType<IntGraphType>>("month")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int year = context.GetArgument<int>("year");
                int month = context.GetArgument<int>("month");

                var result = await dbContext.ChiusureMensili
                    .Include(c => c.ChiusaDaUtente)
                    .Include(c => c.Spese)
                        .ThenInclude(s => s.Pagamento)
                    .FirstOrDefaultAsync(c => c.Anno == year && c.Mese == month);

                return result;
            });

        // Get monthly closure by ID
        Field<MonthlyClosureType, ChiusuraMensile>("monthlyClosureById")
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
    }
}
