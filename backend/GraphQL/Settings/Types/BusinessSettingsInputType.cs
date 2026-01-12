using GraphQL.Types;

namespace duedgusto.GraphQL.Settings.Types;

public class BusinessSettingsInput
{
    public int? SettingsId { get; set; }
    public string? BusinessName { get; set; }
    public string? OpeningTime { get; set; }
    public string? ClosingTime { get; set; }
    public string? OperatingDays { get; set; }
    public string? Timezone { get; set; }
    public string? Currency { get; set; }
    public decimal? VatRate { get; set; }
}

public class BusinessSettingsInputType : InputObjectGraphType<BusinessSettingsInput>
{
    public BusinessSettingsInputType()
    {
        Field(x => x.SettingsId, nullable: true);
        Field(x => x.BusinessName, nullable: true);
        Field(x => x.OpeningTime, nullable: true);
        Field(x => x.ClosingTime, nullable: true);
        Field(x => x.OperatingDays, nullable: true);
        Field(x => x.Timezone, nullable: true);
        Field(x => x.Currency, nullable: true);
        Field(x => x.VatRate, nullable: true);
    }
}
