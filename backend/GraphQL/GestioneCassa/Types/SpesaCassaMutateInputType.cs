using GraphQL.Types;
using duedgusto.Models;

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
    public CategoriaSpesa Categoria { get; set; } = CategoriaSpesa.Altro;
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
        // CategoriaSpesaGraphType, MAI EnumerationGraphType<CategoriaSpesa>: quello espone i
        // valori in CONSTANT_CASE e fa fallire la coercizione delle variabili.
        Field(x => x.Categoria, type: typeof(NonNullGraphType<CategoriaSpesaGraphType>));
    }
}
