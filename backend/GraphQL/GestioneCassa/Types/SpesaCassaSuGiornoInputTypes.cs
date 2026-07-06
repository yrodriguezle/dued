using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Input per <c>aggiungiSpesaCassaSuGiorno</c>: crea una singola SpesaCassa (non tracciata)
/// sul registro del giorno indicato dalla Data (find-or-create). L'UtenteId è ricavato dal JWT.
/// </summary>
public class AggiungiSpesaCassaSuGiornoInput
{
    public DateTime Data { get; set; }
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    public CategoriaSpesa Categoria { get; set; } = CategoriaSpesa.Altro;
}

public class AggiungiSpesaCassaSuGiornoInputType : InputObjectGraphType<AggiungiSpesaCassaSuGiornoInput>
{
    public AggiungiSpesaCassaSuGiornoInputType()
    {
        Name = "AggiungiSpesaCassaSuGiornoInput";
        Field(x => x.Data, type: typeof(DateTimeGraphType));
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        Field(x => x.Categoria, type: typeof(NonNullGraphType<EnumerationGraphType<CategoriaSpesa>>));
    }
}

/// <summary>
/// Input per <c>aggiornaSpesaCassaSuGiorno</c>: aggiorna la SpesaCassa <c>SpesaId</c>.
/// Se <c>Data</c> coincide con quella del registro attuale l'aggiornamento è in loco;
/// se cambia, la riga viene spostata sul registro (find-or-create) dell'altro giorno.
/// </summary>
public class AggiornaSpesaCassaSuGiornoInput
{
    public int SpesaId { get; set; }
    public DateTime Data { get; set; }
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    public CategoriaSpesa Categoria { get; set; } = CategoriaSpesa.Altro;
}

public class AggiornaSpesaCassaSuGiornoInputType : InputObjectGraphType<AggiornaSpesaCassaSuGiornoInput>
{
    public AggiornaSpesaCassaSuGiornoInputType()
    {
        Name = "AggiornaSpesaCassaSuGiornoInput";
        Field(x => x.SpesaId);
        Field(x => x.Data, type: typeof(DateTimeGraphType));
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        Field(x => x.Categoria, type: typeof(NonNullGraphType<EnumerationGraphType<CategoriaSpesa>>));
    }
}
