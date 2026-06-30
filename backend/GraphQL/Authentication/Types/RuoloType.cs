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
        Field<ListGraphType<IntGraphType>>("menuIds")
            .Resolve(context => context.GetMenuIdsByRuoloId(context.Source.Id));
    }
}
