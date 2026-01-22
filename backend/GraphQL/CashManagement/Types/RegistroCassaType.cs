using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.Authentication;

namespace duedgusto.GraphQL.CashManagement.Types;

public class RegistroCassaType : ObjectGraphType<RegistroCassa>
{
    public RegistroCassaType()
    {
        Name = "RegistroCassa";
        Field(x => x.Id);
        Field(x => x.Data, type: typeof(DateTimeGraphType));
        Field(x => x.UtenteId);
        Field(x => x.TotaleApertura);
        Field(x => x.TotaleChiusura);
        Field(x => x.VenditeContanti);
        Field(x => x.IncassoContanteTracciato);
        Field(x => x.IncassiElettronici);
        Field(x => x.IncassiFattura);
        Field(x => x.TotaleVendite);
        Field(x => x.SpeseFornitori);
        Field(x => x.SpeseGiornaliere);
        Field(x => x.ContanteAtteso);
        Field(x => x.Differenza);
        Field(x => x.ContanteNetto);
        Field(x => x.ImportoIva);
        Field(x => x.Note, nullable: true);
        Field(x => x.Stato);
        Field(x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field(x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<UtenteType, Utente>("utente")
            .Resolve(context => context.Source.Utente);

        Field<ListGraphType<ConteggioMonetaType>, IEnumerable<ConteggioMoneta>>("conteggiApertura")
            .Resolve(context => context.Source.ConteggiMoneta.Where(c => c.IsApertura));

        Field<ListGraphType<ConteggioMonetaType>, IEnumerable<ConteggioMoneta>>("conteggiChiusura")
            .Resolve(context => context.Source.ConteggiMoneta.Where(c => !c.IsApertura));

        Field<ListGraphType<IncassoCassaType>, IEnumerable<IncassoCassa>>("incassi")
            .Resolve(context => context.Source.IncassiCassa);

        Field<ListGraphType<SpesaCassaType>, IEnumerable<SpesaCassa>>("spese")
            .Resolve(context => context.Source.SpeseCassa);
    }
}
