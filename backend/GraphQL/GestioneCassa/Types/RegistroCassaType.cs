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
        Field<UtenteType>("utente")
            .ResolveAsync(async context =>
            {
                return await context.GetUtenteById(context.Source.UtenteId).GetResultAsync();
            });
        Field<ListGraphType<ConteggioMonetaType>>("conteggiApertura")
            .ResolveAsync(async context =>
            {
                return await context.GetConteggiAperturaByRegistroId(context.Source.Id).GetResultAsync();
            });
        Field<ListGraphType<ConteggioMonetaType>>("conteggiChiusura")
            .ResolveAsync(async context =>
            {
                return await context.GetConteggiChiusuraByRegistroId(context.Source.Id).GetResultAsync();
            });
        Field<ListGraphType<IncassoCassaType>>("incassi")
            .ResolveAsync(async context =>
            {
                return await context.GetIncassiByRegistroId(context.Source.Id).GetResultAsync();
            });
        Field<ListGraphType<SpesaCassaType>>("spese")
            .ResolveAsync(async context =>
            {
                return await context.GetSpeseByRegistroId(context.Source.Id).GetResultAsync();
            });
        Field<ListGraphType<PagamentoFornitoreType>>("pagamentiFornitori")
            .ResolveAsync(async context =>
            {
                return await context.GetPagamentiFornitoriByRegistroId(context.Source.Id).GetResultAsync();
            });
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
    }
}
