using GraphQL.Types;

namespace duedgusto.GraphQL.Subscriptions.Types;

public class VenditaCreatedEventType : ObjectGraphType<VenditaCreatedEvent>
{
    public VenditaCreatedEventType()
    {
        Name = "VenditaCreatedEvent";
        Field("venditaId", x => x.VenditaId, type: typeof(IntGraphType));
        Field("registroCassaId", x => x.RegistroCassaId, type: typeof(IntGraphType));
        Field("nomeProdotto", x => x.NomeProdotto);
        Field("quantita", x => x.Quantita, type: typeof(IntGraphType));
        Field("prezzoTotale", x => x.PrezzoTotale, type: typeof(DecimalGraphType));
        Field("dataOra", x => x.DataOra, type: typeof(DateTimeGraphType));
    }
}
