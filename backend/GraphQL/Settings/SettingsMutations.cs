using Microsoft.EntityFrameworkCore;
using GraphQL;
using GraphQL.Types;
using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;

namespace duedgusto.GraphQL.Settings;

public class SettingsMutations : ObjectGraphType
{
    public SettingsMutations()
    {
        this.Authorize();

        // Create or Update BusinessSettings
        Field<BusinessSettingsType, BusinessSettings>("updateBusinessSettings")
            .Argument<NonNullGraphType<BusinessSettingsInputType>>("settings", "Business settings data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var input = context.GetArgument<dynamic>("settings");

                BusinessSettings? settings = null;

                // Try to get existing settings (normally only one record)
                settings = await dbContext.BusinessSettings.FirstOrDefaultAsync();

                if (settings == null)
                {
                    // Create new
                    settings = new BusinessSettings();
                    dbContext.BusinessSettings.Add(settings);
                }

                // Update fields if provided
                if (input != null)
                {
                    if (input.businessName is string businessName && !string.IsNullOrEmpty(businessName))
                    {
                        settings.BusinessName = businessName;
                    }

                    if (input.openingTime is string openingTime && !string.IsNullOrEmpty(openingTime))
                    {
                        settings.OpeningTime = openingTime;
                    }

                    if (input.closingTime is string closingTime && !string.IsNullOrEmpty(closingTime))
                    {
                        settings.ClosingTime = closingTime;
                    }

                    if (input.operatingDays is string operatingDays && !string.IsNullOrEmpty(operatingDays))
                    {
                        settings.OperatingDays = operatingDays;
                    }

                    if (input.timezone is string timezone && !string.IsNullOrEmpty(timezone))
                    {
                        settings.Timezone = timezone;
                    }

                    if (input.currency is string currency && !string.IsNullOrEmpty(currency))
                    {
                        settings.Currency = currency;
                    }

                    if (input.vatRate is decimal vatRate && vatRate > 0)
                    {
                        settings.VatRate = vatRate;
                    }
                }

                settings.UpdatedAt = DateTime.UtcNow;

                await dbContext.SaveChangesAsync();
                return settings;
            });
    }
}
