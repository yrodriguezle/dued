using GraphQL.Types;

namespace duedgusto.GraphQL.Vendite.Types;

/// <summary>
/// L'esito di <c>chiudiOrdine</c>: l'ordine di partenza, i figli se era uno split, e il resto da
/// rendere.
///
/// <para>ℹ️ <c>ordine</c> torna <c>CHIUSO</c> con un taglio solo e <c>SPLITTATO</c> con n. Nel
/// secondo caso il suo <c>metodoPagamento</c> è <c>null</c> — non ha incassato con alcun metodo —
/// mentre <c>totaleOrdine</c> conserva il totale intero: dice quanto valeva, non come è stato
/// pagato. Sono i figli in <c>ordiniGenerati</c> ad avere ciascuno il proprio metodo.</para>
/// </summary>
public class EsitoChiusuraOrdineType : ObjectGraphType<EsitoChiusuraOrdine>
{
    public EsitoChiusuraOrdineType()
    {
        Field<NonNullGraphType<OrdineType>>("ordine")
            .Resolve(context => context.Source.Ordine);

        Field<NonNullGraphType<ListGraphType<NonNullGraphType<OrdineType>>>>("ordiniGenerati")
            .Description("Vuoto per una chiusura semplice, gli n figli CHIUSO per uno split.")
            .Resolve(context => context.Source.OrdiniGenerati);

        // 🔴 «Resto da rendere», mai «resto» da solo: RegistroCassa.Resto è la colonna AG del
        //    foglio di chiusura e significa un'altra cosa. Il valore è derivato — la somma di
        //    (contante ricevuto − totale) sui soli tagli che l'hanno dichiarato — e non è un dato
        //    contabile: non tocca alcun secchio, è un aiuto all'operatore.
        Field<NonNullGraphType<DecimalGraphType>>("restoDaRendere")
            .Resolve(context => context.Source.RestoDaRendere);
    }
}
