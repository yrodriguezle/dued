using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.DataLoaders;

namespace duedgusto.GraphQL.GestioneCassa.Types;

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
        Field(x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field(x => x.UpdatedAt, type: typeof(DateTimeGraphType));

        Field<UtenteType>("utente").Resolve(context => context.GetUtenteById(context.Source.UtenteId));
        Field<ListGraphType<ConteggioMonetaType>>("conteggiApertura").Resolve(context => context.GetConteggiAperturaByRegistroId(context.Source.Id));
        Field<ListGraphType<ConteggioMonetaType>>("conteggiChiusura").Resolve(context => context.GetConteggiChiusuraByRegistroId(context.Source.Id));
        Field<ListGraphType<SpesaCassaType>>("spese").Resolve(context => context.GetSpeseByRegistroId(context.Source.Id));
        Field<ListGraphType<PagamentoFornitoreType>>("pagamentiFornitori").Resolve(context => context.GetPagamentiFornitoriByRegistroId(context.Source.Id));
        Field<ListGraphType<RegistroCassaIvaType>>("breakdownIva").Resolve(context => context.GetBreakdownIvaByRegistroId(context.Source.Id));
        Field<ListGraphType<RegistroCassaIvaCreditoType>>("breakdownIvaCredito").Resolve(context => context.GetBreakdownIvaCreditoByRegistroId(context.Source.Id));
    }
}
