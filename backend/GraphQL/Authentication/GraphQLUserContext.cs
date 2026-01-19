using System.Security.Claims;

namespace duedgusto.GraphQL.Authentication;

public class GraphQLUserContext : Dictionary<string, object?>
{
    public ClaimsPrincipal? Principal { get; set; }
    public GraphQLUserContext(ClaimsPrincipal? principal)
    {
        Principal = principal;
    }
}
