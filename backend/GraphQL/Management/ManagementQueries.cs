using GraphQL.Types;

using duedgusto.GraphQL.Authentication;
using duedgusto.Services.GraphQL;
using duedgusto.Models;

namespace duedgusto.GraphQL.Management;

public class ManagementQueries : ObjectGraphType
{
    public ManagementQueries()
    {
        Connection<UserType>("users")
            .Argument<StringGraphType>("where")
            .ResolveAsync(async (context) =>
            {
                Connection<User> connection = await GraphQLService.GetConnectionAsync<User>(context, string.Empty, user => {
                    return (user).UserId.ToString();
                });

                return connection;
            });
    }
}
