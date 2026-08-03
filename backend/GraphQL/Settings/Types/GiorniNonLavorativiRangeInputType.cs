using GraphQL.Types;

namespace duedgusto.GraphQL.Settings.Types;

public class GiorniNonLavorativiRangeInput
{
    public string? DataInizio { get; set; }
    public string? DataFine { get; set; }
    public string? Descrizione { get; set; }
    public string? CodiceMotivo { get; set; }
    public bool? Ricorrente { get; set; }
}

public class GiorniNonLavorativiRangeInputType : InputObjectGraphType<GiorniNonLavorativiRangeInput>
{
    public GiorniNonLavorativiRangeInputType()
    {
        Field(x => x.DataInizio, nullable: true);
        Field(x => x.DataFine, nullable: true);
        Field(x => x.Descrizione, nullable: true);
        Field(x => x.CodiceMotivo, nullable: true);
        Field(x => x.Ricorrente, nullable: true);
    }
}
