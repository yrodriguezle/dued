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
        Field<RuoloType, Ruolo>("mutateRuolo")
            .Argument<NonNullGraphType<RuoloInputType>>("ruolo", "Dati del ruolo da creare o aggiornare")
            .Argument<NonNullGraphType<ListGraphType<IntGraphType>>>("menuIds", "ID dei menu associati al ruolo")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                Ruolo input = context.GetArgument<Ruolo>("ruolo");
                List<int> menuIds = context.GetArgument<List<int>>("menuIds");
                Ruolo? ruolo = await dbContext.Ruoli
                    .Include(r => r.Menus)
                    .FirstOrDefaultAsync(r => r.Id == input.Id);

                if (ruolo == null)
                {
                    ruolo = new Ruolo();
                    dbContext.Ruoli.Add(ruolo);
                }

                ruolo.Nome = input.Nome;
                ruolo.Descrizione = input.Descrizione;

                List<Menu> selectedMenus = await dbContext.Menus
                    .Where(m => menuIds.Contains(m.MenuId))
                    .ToListAsync();

                // Rimuovi i vecchi
                ruolo.Menus
                    .Where(m => !menuIds.Contains(m.MenuId))
                    .ToList()
                    .ForEach(m => ruolo.Menus.Remove(m));

                // Aggiungi i nuovi
                selectedMenus
                    .Where(m => !ruolo.Menus.Any(rm => rm.MenuId == m.MenuId))
                    .ToList()
                    .ForEach(m => ruolo.Menus.Add(m));


                await dbContext.SaveChangesAsync();
                return ruolo;
            });

        Field<UtenteType, Utente>("mutateUtente")
            .Argument<NonNullGraphType<UtenteInputType>>("utente", "Dati dell'utente da creare o aggiornare")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var userArg = context.GetArgument<Dictionary<string, object>>("utente");

                int userId = userArg.ContainsKey("id") ? Convert.ToInt32(userArg["id"]) : 0;
                string? password = userArg.ContainsKey("password") ? userArg["password"]?.ToString() : null;

                Utente? existingUser = await dbContext.Utenti.FindAsync(userId);

                if (existingUser != null)
                {
                    // Update existing user
                    existingUser.NomeUtente = userArg["nomeUtente"].ToString()!;
                    existingUser.Nome = userArg["nome"].ToString()!;
                    existingUser.Cognome = userArg["cognome"].ToString()!;
                    existingUser.Descrizione = userArg.ContainsKey("descrizione") ? userArg["descrizione"]?.ToString() : null;
                    existingUser.Disabilitato = userArg.ContainsKey("disabilitato") ? Convert.ToBoolean(userArg["disabilitato"]) : false;
                    existingUser.RuoloId = Convert.ToInt32(userArg["ruoloId"]);

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

                    Utente newUser = new Utente
                    {
                        NomeUtente = userArg["nomeUtente"].ToString()!,
                        Nome = userArg["nome"].ToString()!,
                        Cognome = userArg["cognome"].ToString()!,
                        Descrizione = userArg.ContainsKey("descrizione") ? userArg["descrizione"]?.ToString() : null,
                        Disabilitato = userArg.ContainsKey("disabilitato") ? Convert.ToBoolean(userArg["disabilitato"]) : false,
                        RuoloId = Convert.ToInt32(userArg["ruoloId"]),
                        Hash = hash,
                        Salt = salt
                    };

                    dbContext.Utenti.Add(newUser);
                    await dbContext.SaveChangesAsync();
                    return newUser;
                }
            });



    }
}
