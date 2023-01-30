using GraphQL;
using GraphQL.Builders;

namespace DueD.Helpers
{
    public class ConnectionArguments
    {
        public string? Select { get; set; }
        public string? Join { get; set; }
        public string? Where { get; set; }
        public string? ExceptSubQuery { get; set; }
        public string? OrderBy { get; set; }

        public ConnectionArguments()
        {
        }

        public ConnectionArguments(IResolveConnectionContext context)
        {
            Join = context.GetArgument<string>("join");
            Where = context.GetArgument<string>("where");
            OrderBy = context.GetArgument<string>("orderBy");
        }
    }
}
