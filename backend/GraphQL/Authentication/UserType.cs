using GraphQL.Types;

using duedgusto.Models;

namespace duedgusto.GraphQL.Authentication;

public class UserType : ObjectGraphType<User>
{
    public UserType()
    {
        Description = "User";
        Field(x => x.UserId, typeof(IntGraphType));
        Field(x => x.UserName, typeof(StringGraphType));
        Field(x => x.FirstName, typeof(StringGraphType));
        Field(x => x.LastName, typeof(StringGraphType));
        Field(x => x.Description, typeof(StringGraphType));
        Field(x => x.Disabled, typeof(BooleanGraphType));
    }
}
