using GraphQL.Types;

namespace duedgusto.GraphQL.Settings.Types;

public class PeriodoProgrammazioneInput
{
    public int? PeriodoId { get; set; }
    public string? DataInizio { get; set; }
    public string? DataFine { get; set; }
    public string? GiorniOperativi { get; set; }
}

public class PeriodoProgrammazioneInputType : InputObjectGraphType<PeriodoProgrammazioneInput>
{
    public PeriodoProgrammazioneInputType()
    {
        Field(x => x.PeriodoId, nullable: true);
        Field(x => x.DataInizio, nullable: true);
        Field(x => x.DataFine, nullable: true);
        Field(x => x.GiorniOperativi, nullable: true);
    }
}
