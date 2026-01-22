using GraphQL.Types;

using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Authentication;

public class UtenteType : ObjectGraphType<Utente>
{
    public UtenteType()
    {
        Name = "Utente";
        Field(x => x.Id, typeof(IntGraphType));
        Field(x => x.NomeUtente, typeof(StringGraphType));
        Field(x => x.Nome, typeof(StringGraphType));
        Field(x => x.Cognome, typeof(StringGraphType));
        Field(x => x.Descrizione, typeof(StringGraphType));
        Field(x => x.Disabilitato, typeof(BooleanGraphType));
        Field(x => x.RuoloId, typeof(IntGraphType));
        Field<RuoloType>("ruolo")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int ruoloId = context.Source.RuoloId;
                return await dbContext.Ruoli.FirstOrDefaultAsync(r => r.Id == ruoloId);
            });
        Field<ListGraphType<MenuType>>("menus")
            .ResolveAsync(async (context) =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int ruoloId = context.Source.RuoloId;
                return await dbContext.Menus
                    .Where(m => m.Ruoli.Any(r => r.Id == ruoloId))
                    .OrderBy(m => m.Posizione)
                    .ToListAsync();
            });
    }
}
