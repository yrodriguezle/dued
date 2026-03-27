using GraphQL.Types;

namespace duedgusto.GraphQL.Fornitori.Types;

public class DocumentoTrasportoInput
{
    public int? DdtId { get; set; }
    public int? FatturaId { get; set; }
    public int FornitoreId { get; set; }
    public string NumeroDdt { get; set; } = string.Empty;
    public DateTime DataDdt { get; set; }
    public decimal? Importo { get; set; }
    public string? Note { get; set; }
    public List<PagamentoFornitoreInput>? Pagamenti { get; set; }
}

public class DocumentoTrasportoInputType : InputObjectGraphType<DocumentoTrasportoInput>
{
    public DocumentoTrasportoInputType()
    {
        Name = "DocumentoTrasportoInput";

        Field(x => x.DdtId, nullable: true);
        Field(x => x.FatturaId, nullable: true);
        Field(x => x.FornitoreId);
        Field(x => x.NumeroDdt);
        Field(x => x.DataDdt, type: typeof(DateGraphType));
        Field(x => x.Importo, nullable: true);
        Field(x => x.Note, nullable: true);
        Field<ListGraphType<PagamentoFornitoreInputType>>("pagamenti");
    }
}
