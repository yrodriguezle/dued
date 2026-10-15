using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Tipo GraphQL per la categoria di spesa configurabile. Espone il <see cref="CategoriaSpesa.Nome"/>
/// come stringa: il frontend continua a trattare la categoria come valore stringa (tendina),
/// mentre l'<see cref="CategoriaSpesa.Id"/> è la chiave esterna persistita su spese e pagamenti.
/// </summary>
public class CategoriaSpesaGraphType : ObjectGraphType<CategoriaSpesa>
{
    public CategoriaSpesaGraphType()
    {
        Name = "CategoriaSpesa";
        Field(x => x.Id);
        Field(x => x.Nome);
        Field(x => x.Attiva);
        Field(x => x.Ordine);
    }
}

/// <summary>
/// Input per <c>mutateCategoriaSpesa</c>: upsert di UNA categoria configurabile.
/// </summary>
public class CategoriaSpesaInput
{
    /// <summary>Null = creazione; valorizzato = aggiornamento.</summary>
    public int? CategoriaId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public bool? Attiva { get; set; }
    public int? Ordine { get; set; }
}

public class CategoriaSpesaInputType : InputObjectGraphType<CategoriaSpesaInput>
{
    public CategoriaSpesaInputType()
    {
        Name = "CategoriaSpesaInput";
        Field(x => x.CategoriaId, nullable: true);
        Field(x => x.Nome);
        Field(x => x.Attiva, nullable: true);
        Field(x => x.Ordine, nullable: true);
    }
}
