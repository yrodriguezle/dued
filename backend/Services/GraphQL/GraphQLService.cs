using GraphQL;

namespace duedgusto.Services.GraphQL;

public static class GraphQLService
{
    public static IServiceProvider GetIServiceProvider(IResolveFieldContext<object?> context)
    {
        using IServiceScope? scope = context.RequestServices?.CreateScope();
        IServiceProvider services = scope?.ServiceProvider ?? throw new Exception();
        return services;
    }
}
