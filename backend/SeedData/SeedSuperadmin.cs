using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.HashPassword;

namespace duedgusto.SeedData;

public static class SeedSuperadmin
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.MigrateAsync();

        if (!dbContext.Roles.Any(r => r.RoleName == "SuperAdmin"))
        {
            var superAdminRole = new Role
            {
                RoleName = "SuperAdmin",
                RoleDescription = "Administrator with full access"
            };
            dbContext.Roles.Add(superAdminRole);
            await dbContext.SaveChangesAsync();
        }

        var role = dbContext.Roles.FirstOrDefault(r => r.RoleName == "SuperAdmin");

        if (!dbContext.User.Any(u => u.UserName == "superadmin"))
        {
            PasswordService.HashPassword("Du3*gust0-2025", out byte[] hash, out byte[] salt);
            var superAdmin = new User
            {
                UserName = "superadmin",
                FirstName = "Super Admin",
                Hash = hash,
                Salt = salt,
                RoleId = role!.RoleId,
                Role = role
            };

            dbContext.User.Add(superAdmin);
            await dbContext.SaveChangesAsync();
        }
    }
}

