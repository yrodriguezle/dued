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
                var menus = await dbContext.Menus
                    .Where(m => m.Ruoli.Any(r => r.Id == ruoloId))
                    .OrderBy(m => m.Posizione)
                    .ToListAsync();
                // Also include parent menus so createDataTree can build the sidebar tree
                var existingIds = menus.Select(m => m.Id).ToHashSet();
                var missingParentIds = menus
                    .Where(m => m.MenuPadreId.HasValue && !existingIds.Contains(m.MenuPadreId!.Value))
                    .Select(m => m.MenuPadreId!.Value)
                    .Distinct()
                    .ToList();
                if (missingParentIds.Count > 0)
                {
                    var parentMenus = await dbContext.Menus
                        .Where(m => missingParentIds.Contains(m.Id))
                        .ToListAsync();
                    menus.AddRange(parentMenus);
                }
                return menus.OrderBy(m => m.Posizione);
            });
    }
}
