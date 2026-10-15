using Microsoft.EntityFrameworkCore;

using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

/// <summary>
/// Garantisce l'esistenza delle categorie di spesa canoniche (le stesse che avevamo come enum).
/// Idempotente: la migrazione le inserisce già, qui si trattano solo eventuali buchi
/// e si preserva l'ordine di visualizzazione.
/// </summary>
public static class SeedCategorieSpesa
{
    private static readonly (string Nome, int Ordine)[] Canoniche =
    [
        ("Affitto", 0),
        ("Utenze", 1),
        ("Stipendi", 2),
        ("Altro", 3),
    ];

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        foreach ((string nome, int ordine) in Canoniche)
        {
            CategoriaSpesa? esistente = await db.CategorieSpesa
                .FirstOrDefaultAsync(c => c.Nome == nome);

            if (esistente == null)
            {
                db.CategorieSpesa.Add(new CategoriaSpesa
                {
                    Nome = nome,
                    Attiva = true,
                    Ordine = ordine
                });
            }
        }

        await db.SaveChangesAsync();
    }
}
