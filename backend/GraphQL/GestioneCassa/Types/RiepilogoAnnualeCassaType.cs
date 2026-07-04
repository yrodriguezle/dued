using GraphQL.Types;

namespace duedgusto.GraphQL.GestioneCassa.Types;

public class RiepilogoMeseCassaType : ObjectGraphType<RiepilogoMeseCassa>
{
    public RiepilogoMeseCassaType()
    {
        Name = "RiepilogoMeseCassa";
        Field(x => x.Anno);
        Field(x => x.Mese);
        Field(x => x.TotaleVendite);
        Field(x => x.RicavoTracciato);
        Field(x => x.RicavoNonTracciato);
        Field(x => x.SpeseTracciate);
        Field(x => x.SpeseNonTracciate);
        Field(x => x.IncassoContanteTracciato);
        Field(x => x.IncassiElettronici);
        Field(x => x.IncassiFattura);
        Field(x => x.Registri);
        Field(x => x.Chiusi);
        Field(x => x.Bozze);
    }
}

public class RiepilogoAnnualeCassaType : ObjectGraphType<RiepilogoAnnualeCassa>
{
    public RiepilogoAnnualeCassaType()
    {
        Name = "RiepilogoAnnualeCassa";
        Field(x => x.Anno);
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<RiepilogoMeseCassaType>>>>("mesi")
            .Description("Esattamente 12 riepiloghi mensili ordinati 1-12 (mesi vuoti a zero)")
            .Resolve(context => context.Source.Mesi);
    }
}
