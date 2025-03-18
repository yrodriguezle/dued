using GraphQL.Types;
using duedgusto.Models.Common;

namespace duedgusto.DataAccess.GraphQL;

public class TokenResponseType : ObjectGraphType<TokenResponse>
{
    public TokenResponseType()
    {
        Name = "TokenResponse";

        Field(x => x.Token, type: typeof(StringGraphType)).Description("Token");
        Field(x => x.RefreshToken, type: typeof(StringGraphType)).Description("RefreshToken");
    }
}
