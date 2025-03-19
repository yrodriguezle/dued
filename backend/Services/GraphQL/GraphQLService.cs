using GraphQL;

namespace duedgusto.Services.GraphQL;

public class GraphQLService
{
    public static IServiceProvider GetServiceProvider(IResolveFieldContext<object?> context)
    {
        if (context.RequestServices == null)
        {
            throw new InvalidOperationException("RequestServices non è disponibile.");
        }

        IServiceScope scope = context.RequestServices.CreateScope();
        return scope.ServiceProvider;
    }
    public static T GetService<T>(IResolveFieldContext<object?> context) where T : class
    {
        IServiceProvider serviceProvider = GetServiceProvider(context);
        return serviceProvider.GetRequiredService<T>();
    }
}
