using GraphQL.Types;

namespace DueD.GraphQL
{
    public class DueDMutations : ObjectGraphType
    {
        public DueDMutations()
        {
            Field<AccountMutationsGroup>("account").Resolve(context => new { });
        }
    }
}
