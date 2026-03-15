using GraphQL.Types;

namespace duedgusto.GraphQL.Fornitori.Types;

public class FatturaAcquistoInput
{
    public int? FatturaId { get; set; }
    public int FornitoreId { get; set; }
    public string NumeroFattura { get; set; } = string.Empty;
    public DateTime DataFattura { get; set; }
    public decimal Imponibile { get; set; }
    public decimal AliquotaIva { get; set; }
    public DateTime? DataScadenza { get; set; }
    public string? Note { get; set; }
    public string Stato { get; set; } = "DA_PAGARE";
}

public class FatturaAcquistoInputType : InputObjectGraphType<FatturaAcquistoInput>
{
    public FatturaAcquistoInputType()
    {
        Name = "FatturaAcquistoInput";

        Field(x => x.FatturaId, nullable: true);
        Field(x => x.FornitoreId);
        Field(x => x.NumeroFattura);
        Field(x => x.DataFattura, type: typeof(DateGraphType));
        Field(x => x.Imponibile);
        Field(x => x.AliquotaIva);
        Field(x => x.DataScadenza, type: typeof(DateGraphType));
        Field(x => x.Note, nullable: true);
        Field(x => x.Stato);
    }
}
