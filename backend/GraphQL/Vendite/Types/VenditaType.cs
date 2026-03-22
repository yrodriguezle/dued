using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.DataLoaders;

namespace duedgusto.GraphQL.Vendite.Types;

public class VenditaType : ObjectGraphType<Vendita>
{
    public VenditaType(ProdottoType prodottoType)
    {
        Field("venditaId", x => x.VenditaId);
        Field("registroCassaId", x => x.RegistroCassaId);
        Field("prodottoId", x => x.ProdottoId);
        Field("quantita", x => x.Quantita);
        Field("prezzoUnitario", x => x.PrezzoUnitario);
        Field("prezzoTotale", x => x.PrezzoTotale);
        Field("note", x => x.Note, nullable: true);
        Field("dataOra", x => x.DataOra);
        Field("creatoIl", x => x.CreatoIl);
        Field("aggiornatoIl", x => x.AggiornatoIl);

        // Navigation property
        Field<ProdottoType>("prodotto")
            .ResolveAsync(async context =>
            {
                return await context.GetProdottoById(context.Source.ProdottoId).GetResultAsync();
            });
    }
}
