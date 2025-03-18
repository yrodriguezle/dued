using GraphQL.Types;
using duedgusto.Models.Database;

namespace duedgusto.DataAccess.GraphQL;

public class UserType : ObjectGraphType<User>
{
    public UserType()
    {
        Name = "User";
        Field(u => u.Id, type: typeof(IntGraphType));
        Field(u => u.Username);
    }
}
