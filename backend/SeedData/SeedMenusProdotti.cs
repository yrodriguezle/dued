using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

/// <summary>
/// La voce di menu dell'<b>anagrafica prodotti</b>, sotto «Cassa».
///
/// <para>File separato da <see cref="SeedMenus"/>, che è già oltre le 900 righe, con la stessa
/// scelta fatta per <see cref="SeedMenusSito"/>: la logica condivisa
/// (<see cref="SeedMenus.UpdateMenuIfNeeded"/>) viene riusata, non copiata.</para>
///
/// <para>⚠️ Sta sotto «Cassa» e non sotto «Sito» pur amministrando gli stessi record: qui si
/// scrive il <b>listino operativo</b> — codice, prezzo, aliquota, stato di vendita — mentre la
/// voce «Prodotti vetrina» scrive come lo stesso prodotto si presenta al cliente. Sono due
/// mestieri diversi sulla stessa riga di database, e tenerli in due punti è ciò che rende
/// leggibile il confine fra i due insiemi di campi.</para>
/// </summary>
public static class SeedMenusProdotti
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

        // ⚠️ Il padre si cerca per Titolo + Percorso vuoto, non per il solo percorso: tutti i
        // menu padre hanno Percorso == string.Empty e sarebbero indistinguibili fra loro.
        Menu? cassaMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Titolo == "Cassa" && m.Percorso == string.Empty);

        if (cassaMenu == null)
        {
            // SeedMenus non ha ancora girato, o la sezione è stata rimossa a mano: senza padre
            // la voce resterebbe orfana in fondo alla barra. Meglio non crearla affatto — il
            // seed è idempotente e la riprende al prossimo avvio.
            return;
        }

        // Voce: Prodotti — l'anagrafica di cassa.
        // PercorsoFile è relativo a duedgusto/src/components/pages/, come "sito/MediaLibrary.tsx".
        Menu? prodottiMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/prodotti");

        if (prodottiMenu == null)
        {
            prodottiMenu = new Menu
            {
                Titolo = "Prodotti",
                Percorso = "/gestionale/cassa/prodotti",
                // 🔴 Un'icona non presente in `iconMapping.tsx` non dà errore: la voce compare
                //    senza icona e la cosa si nota solo guardando la barra. `PackageSearch` è
                //    già mappata, e NON è `ShoppingBag`, che è la vetrina.
                // ⚠️ `PackageSearch` è ORA esclusiva di questa voce: «Lista fornitori» la
                //    condivideva, e le è stata tolta perché un pacco descrive la merce, non i
                //    fornitori. Non riassegnarla altrove: `iconeDelSeed.test.tsx` diventa rosso.
                Icona = "PackageSearch",
                Visibile = true,
                Posizione = 6,
                NomeVista = "ProdottiList",
                PercorsoFile = "prodotti/ProdottiList.tsx",
                MenuPadre = cassaMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(prodottiMenu);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(prodottiMenu, "Prodotti", "/gestionale/cassa/prodotti", "PackageSearch", true, 6,
                "ProdottiList", "prodotti/ProdottiList.tsx", superAdminRuolo, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(prodottiMenu);
            }
        }

        // Voce: Gruppi prodotti — dove si creano i raggruppamenti e ci si mettono dentro i
        // prodotti. Accanto a «Prodotti» perché è la stessa anagrafica vista da un livello sopra.
        Menu? gruppiMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/gruppi-prodotti");

        if (gruppiMenu == null)
        {
            gruppiMenu = new Menu
            {
                Titolo = "Gruppi prodotti",
                Percorso = "/gestionale/cassa/gruppi-prodotti",
                // ⚠️ `Layers` e NON `Boxes`/`Blocks`: sarebbe il secondo pacco accanto a
                //    `PackageSearch` di «Prodotti», e le due voci stanno nello stesso cassetto
                //    una sotto l'altra. Gli strati dicono anche la cosa giusta — un gruppo è un
                //    livello sopra i prodotti. `iconeDelSeed` pretende l'unicità globale.
                Icona = "Layers",
                Visibile = true,
                Posizione = 7,
                NomeVista = "GruppiProdotti",
                PercorsoFile = "vendite/GruppiProdotti.tsx",
                MenuPadre = cassaMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(gruppiMenu);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(gruppiMenu, "Gruppi prodotti", "/gestionale/cassa/gruppi-prodotti", "Layers", true, 7,
                "GruppiProdotti", "vendite/GruppiProdotti.tsx", superAdminRuolo, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(gruppiMenu);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
