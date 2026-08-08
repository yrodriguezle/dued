using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.GestioneCassa.Types;

namespace duedgusto.GraphQL.Fornitori.Types;

public class PagamentoFornitoreInput
{
    public int? PagamentoId { get; set; }
    public int? FatturaId { get; set; }
    public int? DdtId { get; set; }
    public DateTime DataPagamento { get; set; }
    public decimal Importo { get; set; }
    public string? MetodoPagamento { get; set; }
    public string? Descrizione { get; set; }
    public string? Note { get; set; }
    // Categoria opzionale: valorizzata per le spese fisse tracciate, NULL per i pagamenti documentali.
    public CategoriaSpesa? Categoria { get; set; }
}

public class PagamentoFornitoreInputType : InputObjectGraphType<PagamentoFornitoreInput>
{
    public PagamentoFornitoreInputType()
    {
        Name = "PagamentoFornitoreInput";

        Field(x => x.PagamentoId, nullable: true);
        Field(x => x.FatturaId, nullable: true);
        Field(x => x.DdtId, nullable: true);
        Field(x => x.DataPagamento, type: typeof(DateGraphType));
        Field(x => x.Importo);
        Field(x => x.MetodoPagamento, nullable: true);
        Field(x => x.Descrizione, nullable: true);
        Field(x => x.Note, nullable: true);
        Field(x => x.Categoria, type: typeof(CategoriaSpesaGraphType));
    }
}
