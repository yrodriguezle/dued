using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.Repositories.Implementations.Domain;

public class BusinessSettingsRepository : Repository<BusinessSettings>, IBusinessSettingsRepository
{
    public BusinessSettingsRepository(AppDbContext context) : base(context)
    {
    }
}
