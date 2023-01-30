using GraphQL.Builders;

namespace DueD.Helpers
{
    public class ArgumentsConnection
    {
        public string Select { get; set; }
        public string Join { get; set; }
        public string Where { get; set; }
        public string ExceptSubQuery { get; set; }
        public string OrderBy { get; set; }

        public ArgumentsConnection()
        {
        }

        public ArgumentsConnection(IResolveConnectionContext context)
        {
            Join = context.GetArgument<string>("join");
            Where = context.GetArgument<string>("where");
            OrderBy = context.GetArgument<string>("orderBy");
        }
    }
}
