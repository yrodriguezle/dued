using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Input per <c>aggiungiPagamentoFornitoreSuGiorno</c>: crea un PagamentoFornitore sul registro
/// del giorno indicato dalla Data (find-or-create). Se i campi fattura sono valorizzati
/// (<c>FornitoreId</c> presente) viene creata/collegata una FatturaAcquisto ("FA") tramite
/// DocumentiFornitoreService. I DDT sono esclusi (Decision 2). L'UtenteId è ricavato dal JWT.
/// </summary>
public class AggiungiPagamentoFornitoreSuGiornoInput
{
    public DateTime Data { get; set; }
    public decimal Importo { get; set; }
    public string? MetodoPagamento { get; set; }
    public CategoriaSpesa? Categoria { get; set; }

    // Campi fattura opzionali: valorizzare FornitoreId per creare/collegare una FatturaAcquisto.
    public int? FornitoreId { get; set; }
    public string? NumeroFattura { get; set; }
    public DateTime? DataFattura { get; set; }
    public decimal? AliquotaIva { get; set; }
}

public class AggiungiPagamentoFornitoreSuGiornoInputType : InputObjectGraphType<AggiungiPagamentoFornitoreSuGiornoInput>
{
    public AggiungiPagamentoFornitoreSuGiornoInputType()
    {
        Name = "AggiungiPagamentoFornitoreSuGiornoInput";
        Field(x => x.Data, type: typeof(DateTimeGraphType));
        Field(x => x.Importo);
        Field(x => x.MetodoPagamento, nullable: true);
        Field(x => x.Categoria, type: typeof(EnumerationGraphType<CategoriaSpesa>));
        Field(x => x.FornitoreId, nullable: true);
        Field(x => x.NumeroFattura, nullable: true);
        Field(x => x.DataFattura, type: typeof(DateTimeGraphType));
        Field(x => x.AliquotaIva, nullable: true);
    }
}
