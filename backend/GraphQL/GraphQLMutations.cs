using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Vendite;
using duedgusto.GraphQL.Settings;
using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.ChiusureMensili;

namespace duedgusto.GraphQL;

public class GraphQLMutations : ObjectGraphType
{
    public GraphQLMutations()
    {
        Field<AuthMutations>("authentication").Resolve(context => new { });
        Field<GestioneCassaMutations>("gestioneCassa").Resolve(context => new { });
        Field<VenditeMutations>("vendite").Resolve(context => new { });
        Field<SettingsMutations>("settings").Resolve(context => new { });
        Field<FornitoriMutations>("fornitori").Resolve(context => new { });
        Field<ChiusureMensiliMutations>("chiusureMensili").Resolve(context => new { });
    }
}
