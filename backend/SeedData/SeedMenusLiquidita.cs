using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

/// <summary>
/// La voce di menu <b>«Liquidità»</b>, al <b>primo livello</b> della sidebar, affianco a «Cassa».
/// È la view che mostra il saldo cumulativo della cassa e permette di inserire spese
/// extra (beni, macchinari…) con la stessa griglia della chiusura mensile.
///
/// <para>Come <see cref="SeedMenusVendita"/>, è una voce di primo livello: nessuna lookup del
/// menu «Cassa» (che renderebbe la creazione un fallimento silenzioso). Va a tutti i ruoli
/// autenticati, coerentemente con il fatto che la vendita non è un'operazione amministrativa.</para>
/// </summary>
public static class SeedMenusLiquidita
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Ruolo? superAdminRuolo = await dbContext.Ruoli
            .Include(r => r.Menus)
            .FirstOrDefaultAsync(r => r.Nome == "SuperAdmin");
        if (superAdminRuolo == null)
        {
            return;
        }

        List<Ruolo> tuttiIRuoli = await dbContext.Ruoli
            .Include(r => r.Menus)
            .ToListAsync();

        Menu? liquiditaMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/liquidita");

        if (liquiditaMenu == null)
        {
            liquiditaMenu = new Menu
            {
                Titolo = "Liquidità",
                Percorso = "/gestionale/liquidita",
                Icona = "Wallet",
                Visibile = true,
                Posizione = 1,
                NomeVista = "LiquiditaPage",
                PercorsoFile = "liquidita/LiquiditaPage.tsx",
                MenuPadreId = null
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(liquiditaMenu, tuttiIRuoli, ref assegnazioneIniziale);
            dbContext.Menus.Add(liquiditaMenu);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(liquiditaMenu, "Liquidità", "/gestionale/liquidita", "Wallet", true, 1,
                "LiquiditaPage", "liquidita/LiquiditaPage.tsx", superAdminRuolo, null, ref needsUpdate);
            SeedMenus.AssegnaRuoli(liquiditaMenu, tuttiIRuoli, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(liquiditaMenu);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
