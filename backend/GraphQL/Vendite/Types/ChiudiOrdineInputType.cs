using GraphQL.Types;

namespace duedgusto.GraphQL.Vendite.Types;

/// <summary>
/// La forma GraphQL di <see cref="TaglioOrdineInput"/>.
///
/// <para>🔴 <b>Non c'è un campo <c>importo</c>, ed è il punto.</b> La divisione per importo sullo
/// stesso insieme di voci — «30 € in tutto, 20 in contanti e 10 con carta» — non è supportata, e
/// qui non è nemmeno <b>esprimibile</b>: un limite che il contratto non permette di scrivere non
/// ha bisogno di essere controllato a runtime, e non può essere aggirato da un client distratto.
/// Il tentativo arriva al server come una parte senza voci, o come una voce assegnata due volte,
/// e in entrambi i casi <c>ChiudiOrdineOrchestrator</c> risponde dicendo <i>perché</i>: il conto
/// si divide per voci, non per importo.</para>
/// </summary>
public class TaglioOrdineInputType : InputObjectGraphType<TaglioOrdineInput>
{
    public TaglioOrdineInputType()
    {
        Name = "TaglioOrdineInput";
        Field(x => x.MetodoPagamento)
            .Description("Uno dei valori di MetodiPagamentoVendita.");
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("righeOrdineId")
            .Description("Le voci che finiscono in questa parte. Insieme agli altri tagli devono "
                + "partizionare l'ordine esattamente: nessuna voce fuori, nessuna voce in due parti.");
        Field(x => x.ContanteRicevuto, nullable: true)
            .Description("Quanto ha dato il cliente, solo per i metodi in contanti. Serve a "
                + "mostrare il resto da rendere e non tocca alcun secchio.");
    }
}

/// <summary>
/// L'ingresso di <c>chiudiOrdine</c>.
///
/// <para><b>Una sola mutation, anche per lo split.</b> Un taglio è una chiusura semplice, due o più
/// sono uno split, e in entrambi i casi è una transizione, una transazione, un commit. Due mutation
/// distinte — o n chiusure orchestrate dal client — sarebbero n occasioni di doppio incasso su un
/// delta che non è idempotente.</para>
/// </summary>
public class ChiudiOrdineInputType : InputObjectGraphType<ChiudiOrdineInput>
{
    public ChiudiOrdineInputType()
    {
        Name = "ChiudiOrdineInput";
        Field(x => x.OrdineId);
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<TaglioOrdineInputType>>>>("tagli")
            .Description("1 = chiusura semplice, 2..n = split. Vuoto non è ammesso.");
    }
}
