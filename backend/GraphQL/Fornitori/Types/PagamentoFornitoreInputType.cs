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
    // Categoria opzionale (nome stringa): valorizzata per le spese fisse tracciate, NULL per i pagamenti documentali.
    public string? Categoria { get; set; }
    // Solo in creazione: conserva la posizione di inserimento quando una spesa fissa cambia forma
    // (contanti ⇄ tracciata) e viene ricreata. Assente = adesso.
    public DateTime? CreatedAt { get; set; }
    // Solo in creazione: posizione scelta dall'utente, da conservare insieme a CreatedAt.
    public int? Ordine { get; set; }
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
        Field(x => x.Categoria, nullable: true);
        Field(x => x.CreatedAt, type: typeof(DateTimeGraphType), nullable: true);
        Field(x => x.Ordine, nullable: true);
    }
}
