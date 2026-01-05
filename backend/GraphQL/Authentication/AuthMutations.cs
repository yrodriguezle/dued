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
                var userArg = context.GetArgument<Dictionary<string, object>>("user");

                int userId = userArg.ContainsKey("userId") ? Convert.ToInt32(userArg["userId"]) : 0;
                string? password = userArg.ContainsKey("password") ? userArg["password"]?.ToString() : null;

                User? existingUser = await dbContext.User.FindAsync(userId);

                if (existingUser != null)
                {
                    // Update existing user
                    existingUser.UserName = userArg["userName"].ToString()!;
                    existingUser.FirstName = userArg["firstName"].ToString()!;
                    existingUser.LastName = userArg["lastName"].ToString()!;
                    existingUser.Description = userArg.ContainsKey("description") ? userArg["description"]?.ToString() : null;
                    existingUser.Disabled = userArg.ContainsKey("disabled") ? Convert.ToBoolean(userArg["disabled"]) : false;
                    existingUser.RoleId = Convert.ToInt32(userArg["roleId"]);

                    // Se è fornita una nuova password, aggiorna hash e salt
                    if (!string.IsNullOrEmpty(password))
                    {
                        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);
                        existingUser.Hash = hash;
                        existingUser.Salt = salt;
                    }

                    await dbContext.SaveChangesAsync();
                    return existingUser;
                }
                else
                {
                    // Create new user - la password è obbligatoria
                    if (string.IsNullOrEmpty(password))
                    {
                        throw new ExecutionError("La password è obbligatoria per creare un nuovo utente");
                    }

                    PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

                    User newUser = new User
                    {
                        UserName = userArg["userName"].ToString()!,
                        FirstName = userArg["firstName"].ToString()!,
                        LastName = userArg["lastName"].ToString()!,
                        Description = userArg.ContainsKey("description") ? userArg["description"]?.ToString() : null,
                        Disabled = userArg.ContainsKey("disabled") ? Convert.ToBoolean(userArg["disabled"]) : false,
                        RoleId = Convert.ToInt32(userArg["roleId"]),
                        Hash = hash,
                        Salt = salt
                    };

                    dbContext.User.Add(newUser);
                    await dbContext.SaveChangesAsync();
                    return newUser;
                }
            });
    }
}
