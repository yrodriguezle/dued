using GraphQL.Types;

using duedgusto.Models;

namespace duedgusto.GraphQL.Vendite.Types;

/// <summary>
/// Un membro del gruppo: il prodotto più il posto che occupa <b>dentro</b> quel gruppo.
///
/// <para>⚠️ L'ordinamento sta qui e non su <c>Prodotto</c> perché è per gruppo: lo stesso spritz
/// può essere il primo sotto «Spritz» e il terzo sotto «Aperitivi».</para>
/// </summary>
public class MembroGruppoType : ObjectGraphType<ProdottoGruppo>
{
    public MembroGruppoType()
    {
        Name = "MembroGruppo";

        Field("prodottoId", x => x.ProdottoId);
        Field("ordinamento", x => x.Ordinamento);

        Field<ProdottoType>("prodotto")
            .Description("Il prodotto. Richiede Include(g => g.Membri).ThenInclude(m => m.Prodotto) "
                + "a monte: il lazy loading è disabilitato e senza quello il campo è sempre null.")
            .Resolve(context => context.Source.Prodotto);
    }
}

/// <summary>
/// Un gruppo di prodotti, come lo vede il punto vendita.
///
/// <para>🔴 <b><c>prezzoMinimo</c> è calcolato in lettura e non è persistito.</b> Un prezzo
/// indicativo salvato sul gruppo invecchia in silenzio: diverge dal listino il giorno in cui
/// qualcuno ritocca una variante senza ripassare di qui, e nessuno se ne accorge finché un
/// cliente non legge un prezzo che non esiste più.</para>
///
/// <para>⚠️ <c>prezzoUniforme</c> esiste perché il tastone possa dire «2,50 €» invece di
/// «da 2,50 €» quando tutte le varianti costano uguale: il «da» su un gruppo a prezzo unico
/// promette una scelta che non c'è.</para>
/// </summary>
public class GruppoProdottiType : ObjectGraphType<GruppoProdotti>
{
    public GruppoProdottiType()
    {
        Name = "GruppoProdotti";

        Field("gruppoProdottiId", x => x.GruppoProdottiId);
        Field("codice", x => x.Codice);
        Field("nome", x => x.Nome);
        Field("colore", x => x.Colore, nullable: true);
        Field("ordinamento", x => x.Ordinamento);
        Field("attivo", x => x.Attivo);

        Field<ListGraphType<MembroGruppoType>>("membri")
            .Description("Le varianti del gruppo, ordinate per Ordinamento e, a pari merito, per codice.")
            .Resolve(context => context.Source.Membri
                .OrderBy(m => m.Ordinamento)
                .ThenBy(m => m.Prodotto?.Codice)
                .ToList());

        Field<DecimalGraphType>("prezzoMinimo")
            .Description("Il minimo fra i membri ATTIVI, per il «da X €» sul tastone. Calcolato "
                + "in lettura e mai persistito: un prezzo salvato qui invecchierebbe in silenzio.")
            .Resolve(context =>
            {
                List<decimal> prezzi = PrezziAttivi(context.Source);
                return prezzi.Count == 0 ? (decimal?)null : prezzi.Min();
            });

        Field<BooleanGraphType>("prezzoUniforme")
            .Description("Vero se tutte le varianti attive costano uguale: allora il tastone "
                + "mostra il prezzo nudo, senza «da».")
            .Resolve(context =>
            {
                List<decimal> prezzi = PrezziAttivi(context.Source);
                return prezzi.Count > 0 && prezzi.Min() == prezzi.Max();
            });
    }

    /// <summary>
    /// I prezzi dei soli membri <b>attivi</b>.
    ///
    /// <para>⚠️ Il filtro su <c>Attivo</c> non è pignoleria: una variante disattivata resta
    /// nell'appartenenza — i prodotti non si eliminano — e se entrasse nel minimo il tastone
    /// mostrerebbe «da 2,00 €» per una voce che al banco non si può più battere.</para>
    /// </summary>
    private static List<decimal> PrezziAttivi(GruppoProdotti gruppo) =>
        gruppo.Membri
            .Where(m => m.Prodotto != null && m.Prodotto.Attivo)
            .Select(m => m.Prodotto.Prezzo)
            .ToList();
}

/// <summary>
/// L'input di <c>mutateGruppoProdotti</c>: upsert per <c>gruppoProdottiId</c> (assente o 0 =
/// creazione), con l'elenco dei membri <b>al completo</b>.
///
/// <para>🔴 <b>I membri si inviano tutti, ed è una sostituzione totale.</b> L'alternativa —
/// aggiungi/togli uno per volta — avrebbe richiesto due mutation in più e avrebbe reso il
/// riordino una sequenza di chiamate che può interrompersi a metà, lasciando il gruppo in un
/// ordine che nessuno ha scelto. Qui la pagina manda ciò che vede e il server ci si allinea.</para>
/// </summary>
public class GruppoProdottiInput
{
    public int? GruppoProdottiId { get; set; }
    public string Codice { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Colore { get; set; }
    public int? Ordinamento { get; set; }
    public bool Attivo { get; set; } = true;

    /// <summary>
    /// I membri, nell'ordine in cui devono comparire. ⚠️ <c>null</c> significa «non toccare
    /// l'elenco», lista vuota significa «svuotalo»: sono due intenzioni diverse e confonderle
    /// cancellerebbe i membri a ogni rinomina del gruppo.
    /// </summary>
    public List<MembroGruppoInput>? Membri { get; set; }
}

public class MembroGruppoInput
{
    public int ProdottoId { get; set; }
    public int Ordinamento { get; set; }
}

public class MembroGruppoInputType : InputObjectGraphType<MembroGruppoInput>
{
    public MembroGruppoInputType()
    {
        Name = "MembroGruppoInput";
        Field(x => x.ProdottoId);
        Field(x => x.Ordinamento, nullable: true);
    }
}

public class GruppoProdottiInputType : InputObjectGraphType<GruppoProdottiInput>
{
    public GruppoProdottiInputType()
    {
        Name = "GruppoProdottiInput";
        Field(x => x.GruppoProdottiId, nullable: true);
        Field(x => x.Codice);
        Field(x => x.Nome);
        Field(x => x.Colore, nullable: true);
        Field(x => x.Ordinamento, nullable: true);
        Field(x => x.Attivo, nullable: true);
        Field<ListGraphType<MembroGruppoInputType>>("membri");
    }
}
