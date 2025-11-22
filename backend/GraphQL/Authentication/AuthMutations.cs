using System.Security.Claims;

using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.HashPassword;
using duedgusto.Services.Jwt;
using duedgusto.Helpers;

namespace duedgusto.GraphQL.Authentication;

public class AuthMutations : ObjectGraphType
{
    public AuthMutations()
    {
        Field<RoleType, Role>("mutateRole")
            .Argument<NonNullGraphType<RoleInputType>>("role", "Dati del ruolo da creare o aggiornare")
            .Argument<NonNullGraphType<ListGraphType<IntGraphType>>>("menuIds", "ID dei menu associati al ruolo")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                Role input = context.GetArgument<Role>("role");
                List<int> menuIds = context.GetArgument<List<int>>("menuIds");
                Role? role = await dbContext.Roles
                    .Include(r => r.Menus)
                    .FirstOrDefaultAsync(r => r.RoleId == input.RoleId);

                if (role == null)
                {
                    role = new Role();
                    dbContext.Roles.Add(role);
                }

                role.RoleName = input.RoleName;
                role.RoleDescription = input.RoleDescription;

                List<Menu> selectedMenus = await dbContext.Menus
                    .Where(m => menuIds.Contains(m.MenuId))
                    .ToListAsync();

                // Rimuovi i vecchi
                role.Menus
                    .Where(m => !menuIds.Contains(m.MenuId))
                    .ToList()
                    .ForEach(m => role.Menus.Remove(m));

                // Aggiungi i nuovi
                selectedMenus
                    .Where(m => !role.Menus.Any(rm => rm.MenuId == m.MenuId))
                    .ToList()
                    .ForEach(m => role.Menus.Add(m));


                await dbContext.SaveChangesAsync();
                return role;
            });

        Field<UserType, User>("mutateUser")
            .Argument<NonNullGraphType<UserInputType>>("user", "Dati dell'utente da creare o aggiornare")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                User input = context.GetArgument<User>("user");

                User? existingUser = await dbContext.User.FindAsync(input.UserId);
                User updatedUser = await dbContext.AddOrUpdateAsync(input);
                await dbContext.SaveChangesAsync();
                return updatedUser;
            });
    }
}
