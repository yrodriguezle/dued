using GraphQL.Types;

using duedgusto.Models;
using duedgusto.GraphQL.DataLoaders;

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
        Field(x => x.Amministratore, typeof(NonNullGraphType<BooleanGraphType>))
            .Description("Il ruolo ha privilegi amministrativi (es. riapertura di un registro cassa chiuso)");
        Field<ListGraphType<IntGraphType>>("menuIds")
            .Resolve(context => context.GetMenuIdsByRuoloId(context.Source.Id));
    }
}
