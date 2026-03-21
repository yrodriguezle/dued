using GraphQL.Types;

namespace duedgusto.GraphQL.Subscriptions.Types;

public class RegistroCassaUpdatedEventType : ObjectGraphType<RegistroCassaUpdatedEvent>
{
    public RegistroCassaUpdatedEventType()
    {
        Name = "RegistroCassaUpdatedEvent";
        Field("registroCassaId", x => x.RegistroCassaId, type: typeof(IntGraphType));
        Field("data", x => x.Data, type: typeof(DateTimeGraphType));
        Field("stato", x => x.Stato);
        Field("totaleVendite", x => x.TotaleVendite, type: typeof(DecimalGraphType));
        Field("totaleApertura", x => x.TotaleApertura, type: typeof(DecimalGraphType));
        Field("totaleChiusura", x => x.TotaleChiusura, type: typeof(DecimalGraphType));
        Field("azione", x => x.Azione);
    }
}
