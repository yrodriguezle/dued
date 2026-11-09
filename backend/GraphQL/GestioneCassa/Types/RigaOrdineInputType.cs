using GraphQL.Types;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Una riga della griglia spese fisse con la posizione scelta dall'utente. Le righe stanno in
/// due tabelle (<c>SpeseCassa</c>, <c>PagamentiFornitori</c>) con id indipendenti: il tipo dice
/// quale delle due.
/// </summary>
public class RigaOrdineInput
{
    /// <summary><c>SPESA</c> (SpesaCassa) oppure <c>PAGAMENTO</c> (PagamentoFornitore).</summary>
    public string Tipo { get; set; } = string.Empty;
    public int Id { get; set; }
    public int Ordine { get; set; }
}

public class RigaOrdineInputType : InputObjectGraphType<RigaOrdineInput>
{
    public RigaOrdineInputType()
    {
        Name = "RigaOrdineInput";
        Field(x => x.Tipo);
        Field(x => x.Id);
        Field(x => x.Ordine);
    }
}
