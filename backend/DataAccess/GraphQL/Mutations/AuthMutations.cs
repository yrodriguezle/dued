using GraphQL;
using GraphQL.Types;
using duedgusto.Models.Common;

namespace duedgusto.DataAccess.GraphQL;

public class AuthMutations : ObjectGraphType
{
    public AuthMutations()
    {
        Field<TokenResponseType, TokenResponse>("signIn")
            .Argument<NonNullGraphType<StringGraphType>>("username")
            .Argument<NonNullGraphType<StringGraphType>>("password")
            .ResolveAsync(async context =>
            {
                try
                {
                    using IServiceScope? scope = context.RequestServices?.CreateScope();
                    IServiceProvider? services = scope?.ServiceProvider;
                    IRepositoryWrapper? repository = services?.GetRequiredService<IRepositoryWrapper>();
                    if (repository == null) return null;

                    return await repository.Users.SignIn(context.GetArgument<string>("username"), context.GetArgument<string>("password"));
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Si è verificato un errore durante il recupero {context.FieldDefinition.Name}: {ex.Message}");
                    return null;
                }
            });
        Field<TokenResponseType, TokenResponse>("refreshToken")
              .Argument<NonNullGraphType<StringGraphType>>("refreshToken")
              .ResolveAsync(async context =>
              {
                  try
                  {
                      using IServiceScope? scope = context.RequestServices?.CreateScope();
                      IServiceProvider? services = scope?.ServiceProvider;
                      IRepositoryWrapper? repository = services?.GetRequiredService<IRepositoryWrapper>();
                      if (repository == null) return null;

                      return await repository.Users.RefreshToken(context.GetArgument<string>("refreshToken"));
                  }
                  catch (Exception ex)
                  {
                      Console.WriteLine($"Si è verificato un errore durante il recupero {context.FieldDefinition.Name}: {ex.Message}");
                      return null;
                  }
              });
    }
}
