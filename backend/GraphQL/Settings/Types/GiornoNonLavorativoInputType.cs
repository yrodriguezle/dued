using GraphQL.Types;

namespace duedgusto.GraphQL.Settings.Types;

public class GiornoNonLavorativoInput
{
    public int? GiornoId { get; set; }
    public string? Data { get; set; }
    public string? Descrizione { get; set; }
    public string? CodiceMotivo { get; set; }
    public bool? Ricorrente { get; set; }
}

public class GiornoNonLavorativoInputType : InputObjectGraphType<GiornoNonLavorativoInput>
{
    public GiornoNonLavorativoInputType()
    {
        Field(x => x.GiornoId, nullable: true);
        Field(x => x.Data, nullable: true);
        Field(x => x.Descrizione, nullable: true);
        Field(x => x.CodiceMotivo, nullable: true);
        Field(x => x.Ricorrente, nullable: true);
    }
}
