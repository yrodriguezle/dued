using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.Connection;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Vendite;
using duedgusto.GraphQL.Settings;
using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.ChiusureMensili;

namespace duedgusto.GraphQL;

public class GraphQLQueries : ObjectGraphType
{
    public GraphQLQueries()
    {
        Field<AuthQueries>("authentication").Resolve(context => new { });
        Field<ConnectionQueries>("connection").Resolve(context => new { });
        Field<GestioneCassaQueries>("gestioneCassa").Resolve(context => new { });
        Field<VenditeQueries>("vendite").Resolve(context => new { });
        Field<SettingsQueries>("settings").Resolve(context => new { });
        Field<FornitoriQueries>("fornitori").Resolve(context => new { });
        Field<ChiusureMensiliQueries>("chiusureMensili").Resolve(context => new { });
    }
}
