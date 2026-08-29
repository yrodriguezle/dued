using GraphQL.Types;

using duedgusto.GraphQL.DataLoaders;
using duedgusto.Models;

namespace duedgusto.GraphQL.Vendite.Types;

/// <summary>
/// Una voce battuta dentro un ordine aperto.
///
/// <para>⚠️ <b>Non è una vendita</b>, e la differenza è tutto il change: finché l'ordine è
/// <c>APERTO</c> questa riga non ha mosso alcun secchio del registro e non esiste alcuna
/// <c>Vendita</c> corrispondente. <c>prezzoUnitario</c> e <c>aliquotaIva</c> sono lo snapshot preso
/// <b>quando la voce è stata battuta</b> — il prezzo detto al cliente — e la <c>Vendita</c> li
/// eredita alla chiusura.</para>
///
/// <para>ℹ️ Niente <c>imponibile</c> né <c>importoIva</c> qui: lo scorporo è un fatto della vendita
/// incassata e vive in un punto solo (<c>RicalcolaImportiSnapshot</c>). Esporli sulla riga
/// suggerirebbe che esistano prima dell'incasso.</para>
/// </summary>
public class RigaOrdineType : ObjectGraphType<RigaOrdine>
{
    public RigaOrdineType()
    {
        Field("rigaOrdineId", x => x.RigaOrdineId);
        Field("ordineId", x => x.OrdineId);
        Field("prodottoId", x => x.ProdottoId);
        Field("quantita", x => x.Quantita);
        Field("prezzoUnitario", x => x.PrezzoUnitario);
        Field("prezzoTotale", x => x.PrezzoTotale);
        Field("aliquotaIva", x => x.AliquotaIva);
        Field("note", x => x.Note, nullable: true);
        Field("dataOra", x => x.DataOra);
        Field("createdAt", x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.UpdatedAt, type: typeof(DateTimeGraphType));

        // Stesso loader di VenditaType.prodotto: le voci di un ordine ripetono spesso lo stesso
        // prodotto, e il batch le risolve tutte con una query sola.
        Field<ProdottoType>("prodotto")
            .Resolve(context => context.GetProdottoById(context.Source.ProdottoId));
    }
}
