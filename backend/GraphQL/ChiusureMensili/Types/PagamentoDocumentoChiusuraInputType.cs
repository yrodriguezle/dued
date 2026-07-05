using GraphQL.Types;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

/// <summary>
/// Input di binding per registrare un pagamento fornitore (con documento FA/DDT reale)
/// dalla griglia spese della chiusura mensile.
/// </summary>
public class PagamentoDocumentoChiusuraInput
{
    public int FornitoreId { get; set; }
    /// <summary>"FA" (fattura acquisto) o "DDT" (documento di trasporto).</summary>
    public string TipoDocumento { get; set; } = "FA";
    /// <summary>Numero documento; se vuoto viene generato un placeholder SN-*.</summary>
    public string? NumeroDocumento { get; set; }
    public DateTime DataPagamento { get; set; }
    public decimal Importo { get; set; }
    /// <summary>Aliquota IVA in percentuale (es. 22); se null usa quella del fornitore o 22.</summary>
    public decimal? AliquotaIva { get; set; }
    public string? MetodoPagamento { get; set; }
    /// <summary>Se valorizzato, collega a una fattura acquisto esistente invece di crearne una.</summary>
    public int? FatturaId { get; set; }
    /// <summary>Se valorizzato, collega a un DDT esistente invece di crearne uno.</summary>
    public int? DdtId { get; set; }
}

/// <summary>
/// GraphQL InputObjectGraphType per <see cref="PagamentoDocumentoChiusuraInput"/>.
/// </summary>
public class PagamentoDocumentoChiusuraInputType : InputObjectGraphType<PagamentoDocumentoChiusuraInput>
{
    public PagamentoDocumentoChiusuraInputType()
    {
        Name = "PagamentoDocumentoChiusuraInput";
        Description = "Input per registrare un pagamento fornitore (documento FA/DDT reale) da una chiusura mensile";

        Field(x => x.FornitoreId).Description("ID del fornitore");
        Field(x => x.TipoDocumento).Description("Tipo documento: 'FA' o 'DDT'");
        Field(x => x.NumeroDocumento, nullable: true).Description("Numero documento (vuoto → placeholder SN-*)");
        Field(x => x.DataPagamento, type: typeof(NonNullGraphType<DateTimeGraphType>))
            .Description("Data del pagamento/documento; deve appartenere al mese della chiusura");
        Field(x => x.Importo).Description("Importo lordo (IVA inclusa)");
        Field(x => x.AliquotaIva, nullable: true).Description("Aliquota IVA in percentuale (es. 22)");
        Field(x => x.MetodoPagamento, nullable: true).Description("Metodo di pagamento");
        Field(x => x.FatturaId, nullable: true).Description("Collega a una fattura esistente (opzionale)");
        Field(x => x.DdtId, nullable: true).Description("Collega a un DDT esistente (opzionale)");
    }
}
