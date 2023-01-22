using System;

using GraphQL.Types;
using GraphQL.Instrumentation;

using DueD.Services;

namespace DueD.GraphQL
{
    public class DueDSchema : Schema
    {
        public DueDSchema(IServiceProvider provider, Defer<IAuthenticationService> authService) : base(provider)
        {
            Query = provider.GetRequiredService<DueDQueries>();
            Mutation = provider.GetRequiredService<DueDMutations>();
            Subscription = provider.GetRequiredService<DueDSubscriptions>();

            FieldMiddleware.Use(new DueDMiddleware(authService));
        }
    }
}
