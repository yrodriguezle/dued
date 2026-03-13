using GraphQL.Types;

namespace duedgusto.GraphQL.Vendite.Types;

public class CreaVenditaInput
{
    public int RegistroCassaId { get; set; }
    public int ProdottoId { get; set; }
    public decimal Quantita { get; set; }
    public string? Note { get; set; }
    public DateTime? DataOra { get; set; }
}

public class CreaVenditaInputType : InputObjectGraphType<CreaVenditaInput>
{
    public CreaVenditaInputType()
    {
        Field(x => x.RegistroCassaId);
        Field(x => x.ProdottoId);
        Field(x => x.Quantita);
        Field(x => x.Note, nullable: true);
        Field(x => x.DataOra, type: typeof(DateTimeGraphType));
    }
}
