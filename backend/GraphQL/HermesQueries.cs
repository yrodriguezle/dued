using GraphQL.Types;

namespace DueD.GraphQL
{
    public class DueDQueries : ObjectGraphType
    {
        public DueDQueries()
        {
            Field<AccountQuieriesGroup>("account").Resolve(context => new { });
        }
    }
}
