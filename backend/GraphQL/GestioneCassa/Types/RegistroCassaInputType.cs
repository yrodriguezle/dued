using GraphQL.Types;

namespace duedgusto.GraphQL.GestioneCassa.Types;

public class PagamentoFornitoreRegistroInput
{
    public int? PagamentoId { get; set; }
    public int FornitoreId { get; set; }
    public string NumeroDdt { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    public string? MetodoPagamento { get; set; }
    public string TipoDocumento { get; set; } = "DDT"; // "FA" o "DDT"
    public string? NumeroFattura { get; set; }
    public int? FatturaId { get; set; }
    public int? DdtId { get; set; }
    public DateTime? DataFattura { get; set; }
    public DateTime? DataDdt { get; set; }
    public decimal? AliquotaIva { get; set; }
}

public class PagamentoFornitoreRegistroInputType : InputObjectGraphType<PagamentoFornitoreRegistroInput>
{
    public PagamentoFornitoreRegistroInputType()
    {
        Name = "PagamentoFornitoreRegistroInput";
        Field(x => x.PagamentoId, nullable: true);
        Field(x => x.FornitoreId);
        Field(x => x.NumeroDdt);
        Field(x => x.Importo);
        Field(x => x.MetodoPagamento, nullable: true);
        Field(x => x.TipoDocumento);
        Field(x => x.NumeroFattura, nullable: true);
        Field(x => x.FatturaId, nullable: true);
        Field(x => x.DdtId, nullable: true);
        Field(x => x.DataFattura, nullable: true, type: typeof(DateTimeGraphType));
        Field(x => x.DataDdt, nullable: true, type: typeof(DateTimeGraphType));
        Field(x => x.AliquotaIva, nullable: true);
    }
}

public class RegistroCassaInput
{
    public int? Id { get; set; }
    public DateTime Data { get; set; }
    public int UtenteId { get; set; }
    public List<ConteggioMonetaInput> ConteggiApertura { get; set; } = new();
    public List<ConteggioMonetaInput> ConteggiChiusura { get; set; } = new();
    public List<IncassoCassaInput> Incassi { get; set; } = new();
    public List<SpesaCassaInput> Spese { get; set; } = new();
    public List<PagamentoFornitoreRegistroInput> PagamentiFornitori { get; set; } = new();
    public decimal IncassoContanteTracciato { get; set; }
    public decimal IncassiElettronici { get; set; }
    public decimal IncassiFattura { get; set; }
    public decimal SpeseFornitori { get; set; }
    public decimal SpeseGiornaliere { get; set; }
    public string? Note { get; set; }
    public string Stato { get; set; } = "DRAFT";
}

public class RegistroCassaInputType : InputObjectGraphType<RegistroCassaInput>
{
    public RegistroCassaInputType()
    {
        Name = "RegistroCassaInput";
        Field(x => x.Id, nullable: true);
        Field(x => x.Data, type: typeof(DateTimeGraphType));
        Field(x => x.UtenteId);
        Field<ListGraphType<ConteggioMonetaInputType>>("conteggiApertura");
        Field<ListGraphType<ConteggioMonetaInputType>>("conteggiChiusura");
        Field<ListGraphType<IncassoCassaInputType>>("incassi");
        Field<ListGraphType<SpesaCassaInputType>>("spese");
        Field<ListGraphType<PagamentoFornitoreRegistroInputType>>("pagamentiFornitori");
        Field(x => x.IncassoContanteTracciato);
        Field(x => x.IncassiElettronici);
        Field(x => x.IncassiFattura);
        Field(x => x.SpeseFornitori);
        Field(x => x.SpeseGiornaliere);
        Field(x => x.Note, nullable: true);
        Field(x => x.Stato);
    }
}
