using GraphQL.Types;

using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Authentication;

public class RuoloType : ObjectGraphType<Ruolo>
{
    public RuoloType()
    {
        Name = "Ruolo";
        Description = "Ruolo";
        Field(x => x.Id, typeof(IntGraphType));
        Field(x => x.Nome, typeof(StringGraphType));
        Field(x => x.Descrizione, typeof(StringGraphType));
        Field<ListGraphType<IntGraphType>>("menuIds")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Ruoli
                    .Where(r => r.Id == context.Source.Id)
                    .SelectMany(r => r.Menus.Select(m => m.Id))
                    .ToListAsync();
            });
    }
}
