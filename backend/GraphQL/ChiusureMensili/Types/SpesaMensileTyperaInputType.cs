using GraphQL.Types;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

/// <summary>
/// Input type per creare/aggiornare spese mensili libere
/// </summary>
public class SpesaMensileTyperaInputType : InputObjectGraphType
{
    public SpesaMensileTyperaInputType()
    {
        Name = "SpesaMensileTyperaInput";
        Description = "Input per spesa mensile libera (affitto, utenze, stipendi, altro)";

        Field<IntGraphType>("spesaId").Description("ID della spesa (null per nuova spesa)");
        Field<NonNullGraphType<StringGraphType>>("descrizione").Description("Descrizione della spesa");
        Field<NonNullGraphType<DecimalGraphType>>("importo").Description("Importo della spesa");
        Field<NonNullGraphType<StringGraphType>>("categoria").Description("Categoria: Affitto, Utenze, Stipendi, Altro");
    }
}

/// <summary>
/// Input class per binding
/// </summary>
public class SpesaMensileTyperaInput
{
    public int? SpesaId { get; set; }
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    public string Categoria { get; set; } = string.Empty;
}
