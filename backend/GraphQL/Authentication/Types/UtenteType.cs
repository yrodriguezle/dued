using GraphQL.Types;

using duedgusto.Models;
using duedgusto.GraphQL.DataLoaders;

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
            .Resolve(context => context.GetRuoloById(context.Source.RuoloId));
        Field<ListGraphType<MenuType>>("menus")
            .Resolve(context => context.GetMenusByRuoloId(context.Source.RuoloId));
    }
}
