using GraphQL.Types;

using duedgusto.Models;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Una recensione <b>riportata</b> sul sito, vista da un amministratore.
///
/// <para>⚠️ Espone anche le non pubblicate e le marche temporali, che la rotta pubblica non
/// contiene: è la stessa asimmetria di <see cref="ImpostazioniVetrinaType"/>, ed è la ragione per
/// cui la lettura resta dietro il guard amministratore benché una parte degli stessi dati esca
/// anonima.</para>
/// </summary>
public class RecensioneVetrinaType : ObjectGraphType<RecensioneVetrina>
{
    public RecensioneVetrinaType()
    {
        Field("recensioneVetrinaId", x => x.RecensioneVetrinaId);
        Field("autore", x => x.Autore)
            .Description("Come va firmata in pagina. È una firma, non un identificativo: non "
                + "deve identificare una persona oltre a ciò che quella persona ha già reso "
                + "pubblico.");
        Field("testo", x => x.Testo)
            .Description("Riportato FEDELMENTE. Riscriverlo «perché suoni meglio» e lasciarci la "
                + "firma di un cliente non è marketing: è un'affermazione falsa attribuita a una "
                + "persona reale.");
        Field("fonte", x => x.Fonte, nullable: true)
            .Description("Da dove viene la citazione, es. \"Google\".");
        Field("punteggio", x => x.Punteggio).Description("Da 1 a 5. Il vincolo è a database.");
        Field("ordinamento", x => x.Ordinamento);
        Field("pubblicata", x => x.Pubblicata)
            .Description("Default false: una recensione appena inserita non va online per il "
                + "solo fatto di essere stata salvata.");

        Field("createdAt", x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.UpdatedAt, type: typeof(DateTimeGraphType));
    }
}

/// <summary>
/// Esattamente i campi <b>scrivibili</b> di una recensione, e nient'altro.
///
/// <para>🔴 <b>Nessuna marca temporale</b>: <c>createdAt</c> e <c>updatedAt</c> sono ciò che il
/// sistema ha osservato, non ciò che un client dichiara. È lo stesso argomento di
/// <see cref="ImpostazioniVetrinaInput"/>, e come lì rende sicura l'assegnazione totale del
/// resolver.</para>
/// </summary>
public class RecensioneVetrinaInput
{
    public string Autore { get; set; } = string.Empty;
    public string Testo { get; set; } = string.Empty;
    public string? Fonte { get; set; }
    public int Punteggio { get; set; } = 5;
    public int Ordinamento { get; set; }
    public bool Pubblicata { get; set; }
}

public class RecensioneVetrinaInputType : InputObjectGraphType<RecensioneVetrinaInput>
{
    public RecensioneVetrinaInputType()
    {
        Name = "RecensioneVetrinaInput";
        Description = "Campi scrivibili di una recensione riportata. L'identificativo è un "
            + "argomento a sé della mutation, non un campo qui: un id dentro l'input è un invito "
            + "a passarne un altro.";

        Field(x => x.Autore);
        Field(x => x.Testo);
        Field(x => x.Fonte, nullable: true);
        Field(x => x.Punteggio).Description("Da 1 a 5.");
        Field(x => x.Ordinamento).Description("L'ordine in pagina. A parità vince la più recente.");
        Field(x => x.Pubblicata);
    }
}
