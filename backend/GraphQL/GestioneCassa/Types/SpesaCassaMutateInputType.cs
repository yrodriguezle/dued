using GraphQL.Types;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Input per <c>mutateSpesaCassa</c>: upsert di UNA riga di spesa non tracciata sul registro
/// del giorno indicato da <see cref="Data"/>. Distinto da <c>SpesaCassaInput</c>, che è annidato
/// dentro <c>RegistroCassaInput</c> e non porta né id né data.
/// <para>
/// L'utente non arriva dall'input ma dal JWT: la scrittura è sempre attribuita a chi la esegue.
/// </para>
/// </summary>
public class SpesaCassaMutateInput
{
    /// <summary>Null = creazione; valorizzato = aggiornamento della riga esistente.</summary>
    public int? SpesaId { get; set; }

    /// <summary>Giorno di competenza: determina il registro su cui la spesa viene scritta.</summary>
    public DateTime Data { get; set; }

    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }

    /// <summary>Nome della categoria (stringa). Se assente/null, default "Altro".</summary>
    public string? Categoria { get; set; }

    /// <summary>Annotazione libera, distinta dalla descrizione.</summary>
    public string? Note { get; set; }
}

public class SpesaCassaMutateInputType : InputObjectGraphType<SpesaCassaMutateInput>
{
    public SpesaCassaMutateInputType()
    {
        Name = "SpesaCassaMutateInput";
        Field(x => x.SpesaId, nullable: true);
        Field(x => x.Data, type: typeof(DateTimeGraphType));
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        Field(x => x.Categoria, nullable: true);
        Field(x => x.Note, nullable: true);
    }
}
