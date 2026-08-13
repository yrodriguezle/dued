using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Gli undici campi vetrina di un prodotto, e nient'altro.
///
/// 🔴 <b>Zero campi cassa.</b> Non è un promemoria per chi legge: è il motivo per cui questa
/// change esiste come fase a sé. <c>mutateProdottoVetrina</c> fa un'assegnazione totale dei
/// campi che riceve, quindi se qui comparisse anche solo <c>Prezzo</c>, ogni salvataggio
/// dalla griglia di vetrina riscriverebbe il listino della cassa — e nessuno se ne
/// accorgerebbe finché non salta un conto.
///
/// Il confine non è affidato alla disciplina di chi modifica: <c>ProdottoVetrinaInput</c> non
/// <i>ha</i> i campi contabili, quindi il resolver non possiede il dato per scrivere fuori
/// perimetro nemmeno volendo. Un test strutturale via reflection lo pinna
/// (<c>ProdottoVetrinaInput_NonContieneCampiCassa</c>), perché i test comportamentali
/// passerebbero comunque il giorno in cui qualcuno aggiungesse un campo di troppo.
///
/// Nota simmetrica: l'assenza dei campi vetrina da <c>ProdottoInput</c> è l'altra metà dello
/// stesso confine, ed è pinnata da <c>ProdottoInput_NonContieneCampiVetrina</c>.
/// </summary>
public class ProdottoVetrinaInput
{
    public bool VisibileSulSito { get; set; }
    public string? NomeVetrina { get; set; }
    public string? DescrizioneVetrina { get; set; }
    public string? CategoriaVetrina { get; set; }
    public decimal? PrezzoVetrina { get; set; }
    public int? ImmagineId { get; set; }
    public int OrdinamentoVetrina { get; set; }
    public string? Allergeni { get; set; }
    public bool Novita { get; set; }
    public bool Consigliato { get; set; }
    public DateOnly? InLavagnaDal { get; set; }
}

public class ProdottoVetrinaInputType : InputObjectGraphType<ProdottoVetrinaInput>
{
    public ProdottoVetrinaInputType()
    {
        Name = "ProdottoVetrinaInput";
        Description = "Campi vetrina di un prodotto esistente. Non contiene alcun campo contabile: "
            + "codice, nome, prezzo, categoria, unità di misura, attivo e aliquota IVA "
            + "appartengono alla cassa e si scrivono solo da lì.";

        Field(x => x.VisibileSulSito);
        Field(x => x.NomeVetrina, nullable: true);
        Field(x => x.DescrizioneVetrina, nullable: true);
        Field(x => x.CategoriaVetrina, nullable: true);
        Field(x => x.PrezzoVetrina, nullable: true)
            .Description("null = nessun prezzo proprio, il sito ricade sul prezzo di listino. "
                + "Attenzione: 0 è un valore valorizzato (omaggio), non un'assenza.");
        Field(x => x.ImmagineId, nullable: true);
        Field(x => x.OrdinamentoVetrina);
        Field(x => x.Allergeni, nullable: true);
        Field(x => x.Novita);
        Field(x => x.Consigliato);
        Field(x => x.InLavagnaDal, nullable: true)
            .Description("Il giorno in cui il prodotto sta sulla lavagna all'ingresso. Il sito "
                + "mostra la lavagna SOLO per i prodotti il cui valore è oggi. 🔴 È una data e "
                + "non un interruttore apposta: un booleano resta acceso finché qualcuno se ne "
                + "ricorda, e il primo lunedì di fretta il sito mostra il piatto di venerdì "
                + "scorso come «lavagna di oggi». Una data scade da sola.");
    }
}
