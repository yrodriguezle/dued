using GraphQL.Types;

namespace duedgusto.GraphQL.CashManagement.Types;

public class RegistroCassaInput
{
    public int? Id { get; set; }
    public DateTime Data { get; set; }
    public int UtenteId { get; set; }
    public List<ConteggioMonetaInput> ConteggiApertura { get; set; } = new();
    public List<ConteggioMonetaInput> ConteggiChiusura { get; set; } = new();
    public List<IncassoCassaInput> Incassi { get; set; } = new();
    public List<SpesaCassaInput> Spese { get; set; } = new();
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
        Field(x => x.IncassoContanteTracciato);
        Field(x => x.IncassiElettronici);
        Field(x => x.IncassiFattura);
        Field(x => x.SpeseFornitori);
        Field(x => x.SpeseGiornaliere);
        Field(x => x.Note, nullable: true);
        Field(x => x.Stato);
    }
}
