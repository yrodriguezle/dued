using System.Security.Claims;

namespace duedgusto.GraphQL.Authentication;

public class GraphQLUserContext : Dictionary<string, object?>
{
    public ClaimsPrincipal? User { get; set; }
    public GraphQLUserContext(ClaimsPrincipal? user)
    {
        User = user;
    }
}
