using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

/// <summary>
/// La voce di menu del <b>punto vendita</b>, sotto «Cassa».
///
/// <para>⚠️ Sta in <b>Posizione 1</b>, cioè prima di «Lista Cassa» e di tutto il resto, e non è
/// una questione di gerarchia: è la pagina che si apre dieci volte al giorno da dietro il
/// bancone, mentre le altre si aprono una volta a sera. Su un telefono, ogni voce sopra di lei
/// è uno scorrimento in più con le mani occupate.</para>
///
/// <para>File separato da <see cref="SeedMenusProdotti"/> perché sono due cose diverse:
/// lì si cura il listino, qui si vende. Tenerli distinti costa un file e rende ovvio, aprendo
/// la cartella, che cosa esiste.</para>
/// </summary>
public static class SeedMenusVendita
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

        Menu? cassaMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Titolo == "Cassa" && m.Percorso == string.Empty);

        if (cassaMenu == null)
        {
            // Senza padre la voce resterebbe orfana in fondo alla barra: meglio non crearla e
            // riprovare al prossimo avvio, che il seed è idempotente.
            return;
        }

        Menu? venditaMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/vendita");

        if (venditaMenu == null)
        {
            venditaMenu = new Menu
            {
                Titolo = "Vendita",
                Percorso = "/gestionale/cassa/vendita",
                // 🔴 `ShoppingCart` è già mappata in iconMapping.tsx. Un'icona assente da quella
                //    lista non dà errore: la voce compare senza icona, e ce ne si accorge solo
                //    guardando la barra.
                Icona = "ShoppingCart",
                Visibile = true,
                Posizione = 1,
                NomeVista = "PuntoVendita",
                PercorsoFile = "vendite/PuntoVendita.tsx",
                MenuPadre = cassaMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(venditaMenu);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(venditaMenu, "Vendita", "/gestionale/cassa/vendita", "ShoppingCart", true, 1,
                "PuntoVendita", "vendite/PuntoVendita.tsx", superAdminRuolo, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(venditaMenu);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
