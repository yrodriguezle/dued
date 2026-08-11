using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

/// <summary>
/// Voci di menu della sezione "Sito" — amministrazione del sito vetrina.
/// File separato da <see cref="SeedMenus"/>, che è già oltre le 900 righe: la logica
/// condivisa (<see cref="SeedMenus.UpdateMenuIfNeeded"/> e <see cref="SeedMenus.AssegnaRuoli"/>)
/// viene riusata, non copiata — due implementazioni della stessa idempotenza divergerebbero
/// al primo bugfix applicato a una sola.
/// </summary>
public static class SeedMenusSito
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

        // ========================================
        // Menu Sito — amministrazione della vetrina pubblica
        // ========================================
        // Come la Wiki, questa sezione NON va al solo SuperAdmin ma a ogni ruolo con il
        // flag Amministratore: è lo stesso privilegio che il backend pretende sulle
        // mutation della vetrina e sulla lettura di connection { mediaAssets }.
        // Il SuperAdmin è incluso esplicitamente perché la sezione resti raggiungibile
        // anche se il flag venisse tolto per errore dall'anagrafica ruoli.
        // Il menu è il primo filtro, non l'unico: la sicurezza vera è il guard backend.
        List<Ruolo> ruoliSito = await dbContext.Ruoli
                .Include(r => r.Menus)
                .Where(r => r.Amministratore || r.Nome == "SuperAdmin")
                .ToListAsync();

        // ⚠️ Il padre si cerca per Titolo + Percorso vuoto, non per il solo percorso:
        // tutti i menu padre hanno Percorso == string.Empty e sarebbero indistinguibili
        // fra loro. I figli, che un percorso ce l'hanno, si cercano invece per Percorso.
        Menu? sitoMenu = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Titolo == "Sito" && m.Percorso == string.Empty);

        if (sitoMenu == null)
        {
            sitoMenu = new Menu
            {
                Titolo = "Sito",
                Percorso = string.Empty,
                Icona = "Globe",
                Visibile = true,
                Posizione = 9,
                NomeVista = string.Empty,
                PercorsoFile = string.Empty,
                MenuPadreId = null
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(sitoMenu, ruoliSito, ref assegnazioneIniziale);
            dbContext.Menus.Add(sitoMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere Id
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(sitoMenu, "Sito", null, "Globe", true, 9, null, null, superAdminRuolo, null, ref needsUpdate);
            SeedMenus.AssegnaRuoli(sitoMenu, ruoliSito, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(sitoMenu);
                await dbContext.SaveChangesAsync();
            }
        }

        // Voce: Libreria media
        // PercorsoFile è relativo a duedgusto/src/components/pages/ — come "wiki/RegistroCassaWiki.tsx".
        Menu? sitoChild1 = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/sito/media");

        if (sitoChild1 == null)
        {
            sitoChild1 = new Menu
            {
                Titolo = "Libreria media",
                Percorso = "/gestionale/sito/media",
                Icona = "Images",
                Visibile = true,
                Posizione = 1,
                NomeVista = "MediaLibrary",
                PercorsoFile = "sito/MediaLibrary.tsx",
                MenuPadreId = sitoMenu.Id
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(sitoChild1, ruoliSito, ref assegnazioneIniziale);
            dbContext.Menus.Add(sitoChild1);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(sitoChild1, "Libreria media", "/gestionale/sito/media", "Images", true, 1,
                "MediaLibrary", "sito/MediaLibrary.tsx", superAdminRuolo, sitoMenu, ref needsUpdate);
            SeedMenus.AssegnaRuoli(sitoChild1, ruoliSito, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(sitoChild1);
            }
        }

        // Voce: Prodotti vetrina
        Menu? sitoChild2 = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/sito/prodotti");

        if (sitoChild2 == null)
        {
            sitoChild2 = new Menu
            {
                Titolo = "Prodotti vetrina",
                Percorso = "/gestionale/sito/prodotti",
                Icona = "ShoppingBag",
                Visibile = true,
                Posizione = 2,
                NomeVista = "VetrinaProdottiList",
                PercorsoFile = "sito/VetrinaProdottiList.tsx",
                MenuPadreId = sitoMenu.Id
            };
            bool assegnazioneIniziale = false;
            SeedMenus.AssegnaRuoli(sitoChild2, ruoliSito, ref assegnazioneIniziale);
            dbContext.Menus.Add(sitoChild2);
        }
        else
        {
            bool needsUpdate = false;
            SeedMenus.UpdateMenuIfNeeded(sitoChild2, "Prodotti vetrina", "/gestionale/sito/prodotti", "ShoppingBag", true, 2,
                "VetrinaProdottiList", "sito/VetrinaProdottiList.tsx", superAdminRuolo, sitoMenu, ref needsUpdate);
            SeedMenus.AssegnaRuoli(sitoChild2, ruoliSito, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(sitoChild2);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
