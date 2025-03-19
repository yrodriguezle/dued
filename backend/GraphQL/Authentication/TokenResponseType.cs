using GraphQL.Types;

namespace duedgusto.GraphQL.Authentication;

public class TokenResponseType : ObjectGraphType<TokenResponse>
{
    public TokenResponseType()
    {
        Name = "TokenResponse";

        Field(x => x.Token, type: typeof(StringGraphType)).Description("Token");
        Field(x => x.RefreshToken, type: typeof(StringGraphType)).Description("RefreshToken");
    }
}
