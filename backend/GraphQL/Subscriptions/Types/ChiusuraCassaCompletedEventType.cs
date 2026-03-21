using GraphQL.Types;

namespace duedgusto.GraphQL.Subscriptions.Types;

public class ChiusuraCassaCompletedEventType : ObjectGraphType<ChiusuraCassaCompletedEvent>
{
    public ChiusuraCassaCompletedEventType()
    {
        Name = "ChiusuraCassaCompletedEvent";
        Field("registroCassaId", x => x.RegistroCassaId, type: typeof(IntGraphType));
        Field("data", x => x.Data, type: typeof(DateTimeGraphType));
        Field("totaleChiusura", x => x.TotaleChiusura, type: typeof(DecimalGraphType));
        Field("differenza", x => x.Differenza, type: typeof(DecimalGraphType));
    }
}
