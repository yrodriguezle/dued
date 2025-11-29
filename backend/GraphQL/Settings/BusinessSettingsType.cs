using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Settings;

public class BusinessSettingsType : ObjectGraphType<BusinessSettings>
{
    public BusinessSettingsType()
    {
        Field(x => x.SettingsId);
        Field(x => x.BusinessName);
        Field(x => x.OpeningTime);
        Field(x => x.ClosingTime);
        Field(x => x.OperatingDays);
        Field(x => x.Timezone);
        Field(x => x.Currency);
        Field(x => x.VatRate);
        Field(x => x.CreatedAt);
        Field(x => x.UpdatedAt);
    }
}
