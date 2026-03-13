using GraphQL.Types;

namespace duedgusto.GraphQL.Vendite.Types;

public class AggiornaVenditaInput
{
    public int? ProdottoId { get; set; }
    public decimal? Quantita { get; set; }
    public string? Note { get; set; }
}

public class AggiornaVenditaInputType : InputObjectGraphType<AggiornaVenditaInput>
{
    public AggiornaVenditaInputType()
    {
        Field(x => x.ProdottoId, nullable: true);
        Field(x => x.Quantita, nullable: true);
        Field(x => x.Note, nullable: true);
    }
}
