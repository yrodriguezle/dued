using System.Security.Claims;

namespace duedgusto.Models;

public class UserContext(ClaimsPrincipal principal) : Dictionary<string, object?>
{
    public required ClaimsPrincipal ClaimsPrincipal { get; set; } = principal;
}
