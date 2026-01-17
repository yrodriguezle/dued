using GraphQL.Types;

namespace duedgusto.GraphQL.MonthlyClosures.Types;

public class MonthlyClosureInput
{
    public int? ClosureId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public DateTime LastWorkingDay { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "BOZZA";
}

public class MonthlyClosureInputType : InputObjectGraphType<MonthlyClosureInput>
{
    public MonthlyClosureInputType()
    {
        Name = "MonthlyClosureInput";

        Field(x => x.ClosureId, nullable: true);
        Field(x => x.Year);
        Field(x => x.Month);
        Field(x => x.LastWorkingDay, type: typeof(DateTimeGraphType));
        Field(x => x.Notes, nullable: true);
        Field(x => x.Status);
    }
}
