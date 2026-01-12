using Microsoft.EntityFrameworkCore;
using GraphQL;
using GraphQL.Types;
using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;

using duedgusto.GraphQL.Settings.Types;

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
                try
                {
                    AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                    var input = context.GetArgument<BusinessSettingsInput>("settings");

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
                        if (!string.IsNullOrEmpty(input.BusinessName))
                        {
                            settings.BusinessName = input.BusinessName;
                        }

                        if (!string.IsNullOrEmpty(input.OpeningTime))
                        {
                            settings.OpeningTime = input.OpeningTime;
                        }

                        if (!string.IsNullOrEmpty(input.ClosingTime))
                        {
                            settings.ClosingTime = input.ClosingTime;
                        }

                        if (!string.IsNullOrEmpty(input.OperatingDays))
                        {
                            settings.OperatingDays = input.OperatingDays;
                        }

                        if (!string.IsNullOrEmpty(input.Timezone))
                        {
                            settings.Timezone = input.Timezone;
                        }

                        if (!string.IsNullOrEmpty(input.Currency))
                        {
                            settings.Currency = input.Currency;
                        }

                        if (input.VatRate.HasValue && input.VatRate.Value > 0)
                        {
                            settings.VatRate = input.VatRate.Value;
                        }
                    }

                    settings.UpdatedAt = DateTime.UtcNow;

                    await dbContext.SaveChangesAsync();
                    return settings;
                }
                catch (Exception e)
                {
                    throw;
                }
            });
    }
}
