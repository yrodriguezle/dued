using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.HashPassword;
// using duedgusto.Services.HashPassword;

namespace duedgusto.SeedData;

public static class SeedData
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        //PasswordService passwordService = scope.ServiceProvider.GetRequiredService<PasswordService>();

        await dbContext.Database.MigrateAsync();

        if (!dbContext.User.Any(u => u.UserName == "superadmin"))
        {
            PasswordService.HashPassword("Y4l14n2/15", out byte[] hash, out byte[] salt);
            var superAdmin = new User
            {
                UserName = "superadmin",
                FirstName = "Super Admin",
                Hash = hash,
                Salt = salt,
            };

            dbContext.User.Add(superAdmin);
            await dbContext.SaveChangesAsync();
        }
    }
}
