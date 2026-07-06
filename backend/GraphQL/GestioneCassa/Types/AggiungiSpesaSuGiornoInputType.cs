using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Input per la mutation <c>aggiungiSpesaSuGiorno</c> (registro "leggero"):
/// registra una spesa fissa su un giorno anche in assenza di registro operativo.
/// </summary>
public class AggiungiSpesaSuGiornoInput
{
    public DateTime Data { get; set; }
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    public CategoriaSpesa Categoria { get; set; } = CategoriaSpesa.Altro;
    // true → PagamentoFornitore (tracciata); false → SpesaCassa (contanti, non tracciata).
    public bool Tracciata { get; set; }
    // Usato solo se Tracciata; default "Bonifico" quando assente.
    public string? MetodoPagamento { get; set; }
    public int UtenteId { get; set; }
}

public class AggiungiSpesaSuGiornoInputType : InputObjectGraphType<AggiungiSpesaSuGiornoInput>
{
    public AggiungiSpesaSuGiornoInputType()
    {
        Name = "AggiungiSpesaSuGiornoInput";
        Field(x => x.Data, type: typeof(DateTimeGraphType));
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        Field(x => x.Categoria, type: typeof(NonNullGraphType<EnumerationGraphType<CategoriaSpesa>>));
        Field(x => x.Tracciata);
        Field(x => x.MetodoPagamento, nullable: true);
        Field(x => x.UtenteId);
    }
}
