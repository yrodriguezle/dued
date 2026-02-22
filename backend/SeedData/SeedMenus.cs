using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

public static class SeedMenus
{
    private static void UpdateMenuIfNeeded(Menu menu, string titolo, string? percorso, string icona, bool visibile,
        int posizione, string? nomeVista, string? percorsoFile, Ruolo superAdminRuolo, Menu? menuPadre, ref bool needsUpdate)
    {
        if (menu.Titolo != titolo) { menu.Titolo = titolo; needsUpdate = true; }
        if (menu.Percorso != (percorso ?? string.Empty)) { menu.Percorso = percorso ?? string.Empty; needsUpdate = true; }
        if (menu.Icona != icona) { menu.Icona = icona; needsUpdate = true; }
        if (menu.Visibile != visibile) { menu.Visibile = visibile; needsUpdate = true; }
        if (menu.Posizione != posizione) { menu.Posizione = posizione; needsUpdate = true; }
        if (menu.NomeVista != (nomeVista ?? string.Empty)) { menu.NomeVista = nomeVista ?? string.Empty; needsUpdate = true; }
        if (menu.PercorsoFile != (percorsoFile ?? string.Empty)) { menu.PercorsoFile = percorsoFile ?? string.Empty; needsUpdate = true; }
        if (menu.MenuPadreId != menuPadre?.Id) { menu.MenuPadre = menuPadre; needsUpdate = true; }

        if (!menu.Ruoli.Any(r => r.Id == superAdminRuolo.Id))
        {
            menu.Ruoli.Add(superAdminRuolo);
            needsUpdate = true;
        }
    }

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

        // Clean up duplicate Dashboard menus (keep only one with correct path and filePath)
        var dashboardMenus = await dbContext.Menus
            .Where(m => m.Titolo == "Dashboard" && m.MenuPadreId == null)
            .ToListAsync();

        if (dashboardMenus.Count > 1)
        {
            // Keep the one with the correct path, remove others
            var correctDashboard = dashboardMenus.FirstOrDefault(m => m.Percorso == "/gestionale/dashboard");
            var toRemove = dashboardMenus.Where(m => m != correctDashboard).ToList();

            foreach (var menu in toRemove)
            {
                dbContext.Menus.Remove(menu);
            }

            await dbContext.SaveChangesAsync();
        }

        // First, try to find existing dashboard menu by path
        var dashboardMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/dashboard");

        // If not found, try to find by title (for backwards compatibility with old seed data)
        dashboardMenu ??= await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Dashboard" && m.MenuPadreId == null);

        if (dashboardMenu == null)
        {
            dashboardMenu = new Menu
            {
                Titolo = "Dashboard",
                Percorso = "/gestionale/dashboard",
                Icona = "Dashboard",
                Visibile = true,
                Posizione = 1,
                NomeVista = "HomePage",
                PercorsoFile = "dashboard/HomePage.tsx",
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(dashboardMenu);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(dashboardMenu, "Dashboard", "/gestionale/dashboard", "Dashboard", true, 1,
                "HomePage", "dashboard/HomePage.tsx", superAdminRuolo, null, ref needsUpdate);

            if (needsUpdate)
            {
                dbContext.Menus.Update(dashboardMenu);
            }
        }

        // Menu padre Utenti (senza path)
        var utentiMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Utenti" && m.Percorso == string.Empty);

        if (utentiMenu == null)
        {
            utentiMenu = new Menu
            {
                Titolo = "Utenti",
                Percorso = string.Empty,
                Icona = "Group",
                Visibile = true,
                Posizione = 4,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(utentiMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere Id
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(utentiMenu, "Utenti", null, "Group", true, 4, null, null, superAdminRuolo, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(utentiMenu);
            }
        }

        // Child: Lista utenti
        var utentiChild1 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/users-list");

        if (utentiChild1 == null)
        {
            utentiChild1 = new Menu
            {
                Titolo = "Lista utenti",
                Percorso = "/gestionale/users-list",
                Icona = string.Empty,
                Visibile = true,
                Posizione = 1,
                NomeVista = "UserList",
                PercorsoFile = "users/UserList.tsx",
                MenuPadre = utentiMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(utentiChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(utentiChild1, "Lista utenti", "/gestionale/users-list", string.Empty, true, 1,
                "UserList", "users/UserList.tsx", superAdminRuolo, utentiMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(utentiChild1);
            }
        }

        // Child: Gestione utenti
        var utentiChild2 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/users-details");

        if (utentiChild2 == null)
        {
            utentiChild2 = new Menu
            {
                Titolo = "Gestione utenti",
                Percorso = "/gestionale/users-details",
                Icona = string.Empty,
                Visibile = true,
                Posizione = 2,
                NomeVista = "UserDetails",
                PercorsoFile = "users/UserDetails.tsx",
                MenuPadre = utentiMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(utentiChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(utentiChild2, "Gestione utenti", "/gestionale/users-details", string.Empty, true, 2,
                "UserDetails", "users/UserDetails.tsx", superAdminRuolo, utentiMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(utentiChild2);
            }
        }

        // Menu padre Ruoli (senza path)
        var ruoliMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Ruoli" && m.Percorso == string.Empty);

        if (ruoliMenu == null)
        {
            ruoliMenu = new Menu
            {
                Titolo = "Ruoli",
                Percorso = string.Empty,
                Icona = "Engineering",
                Visibile = true,
                Posizione = 5,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(ruoliMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere Id
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(ruoliMenu, "Ruoli", null, "Engineering", true, 5, null, null, superAdminRuolo, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(ruoliMenu);
            }
        }

        // Child: Lista ruoli
        var ruoliChild1 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/roles-list");

        if (ruoliChild1 == null)
        {
            ruoliChild1 = new Menu
            {
                Titolo = "Lista ruoli",
                Percorso = "/gestionale/roles-list",
                Icona = string.Empty,
                Visibile = true,
                Posizione = 1,
                NomeVista = "RoleList",
                PercorsoFile = "roles/RoleList.tsx",
                MenuPadre = ruoliMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(ruoliChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(ruoliChild1, "Lista ruoli", "/gestionale/roles-list", string.Empty, true, 1,
                "RoleList", "roles/RoleList.tsx", superAdminRuolo, ruoliMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(ruoliChild1);
            }
        }

        // Child: Gestione ruoli
        var ruoliChild2 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/roles-details");

        if (ruoliChild2 == null)
        {
            ruoliChild2 = new Menu
            {
                Titolo = "Gestione ruoli",
                Percorso = "/gestionale/roles-details",
                Icona = string.Empty,
                Visibile = true,
                Posizione = 2,
                NomeVista = "RoleDetails",
                PercorsoFile = "roles/RoleDetails.tsx",
                MenuPadre = ruoliMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(ruoliChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(ruoliChild2, "Gestione ruoli", "/gestionale/roles-details", string.Empty, true, 2,
                "RoleDetails", "roles/RoleDetails.tsx", superAdminRuolo, ruoliMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(ruoliChild2);
            }
        }

        // Menu padre Menù (senza path)
        var menusMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Menù" && m.Percorso == string.Empty);

        if (menusMenu == null)
        {
            menusMenu = new Menu
            {
                Titolo = "Menù",
                Percorso = string.Empty,
                Icona = "List",
                Visibile = true,
                Posizione = 6,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(menusMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere Id
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(menusMenu, "Menù", null, "List", true, 6, null, null, superAdminRuolo, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(menusMenu);
            }
        }

        // Child: Lista menù
        var menusChild1 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/menus-list");

        if (menusChild1 == null)
        {
            menusChild1 = new Menu
            {
                Titolo = "List menù",
                Percorso = "/gestionale/menus-list",
                Icona = string.Empty,
                Visibile = true,
                Posizione = 1,
                NomeVista = "MenuList",
                PercorsoFile = "menu/MenuList.tsx",
                MenuPadre = menusMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(menusChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(menusChild1, "List menù", "/gestionale/menus-list", string.Empty, true, 1,
                "MenuList", "menu/MenuList.tsx", superAdminRuolo, menusMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(menusChild1);
            }
        }

        // Child: Gestione menù
        var menusChild2 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/menus-details");

        if (menusChild2 == null)
        {
            menusChild2 = new Menu
            {
                Titolo = "Gestione menù",
                Percorso = "/gestionale/menus-details",
                Icona = string.Empty,
                Visibile = true,
                Posizione = 2,
                NomeVista = "MenuDetails",
                PercorsoFile = "menu/MenuDetails.tsx",
                MenuPadre = menusMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(menusChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(menusChild2, "Gestione menù", "/gestionale/menus-details", string.Empty, true, 2,
                "MenuDetails", "menu/MenuDetails.tsx", superAdminRuolo, menusMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(menusChild2);
            }
        }

        // Menu Impostazioni
        var settingsMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/settings");

        if (settingsMenu == null)
        {
            settingsMenu = new Menu
            {
                Titolo = "Impostazioni",
                Percorso = "/gestionale/settings",
                Icona = "Settings",
                Visibile = true,
                Posizione = 7,
                NomeVista = "SettingsDetails",
                PercorsoFile = "settings/SettingsDetails.tsx",
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(settingsMenu);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(settingsMenu, "Impostazioni", "/gestionale/settings", "Settings", true, 7,
                "SettingsDetails", "settings/SettingsDetails.tsx", superAdminRuolo, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(settingsMenu);
            }
        }

        // Menu padre Cassa (senza path e FilePath - collapsible menu group)
        var cassaMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Cassa" && m.Percorso == string.Empty);

        if (cassaMenu == null)
        {
            // Try to find old Cassa menu by path and remove it if it exists
            var oldCassaMenu = await dbContext.Menus
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa");
            if (oldCassaMenu != null)
            {
                dbContext.Menus.Remove(oldCassaMenu);
                await dbContext.SaveChangesAsync();
            }

            cassaMenu = new Menu
            {
                Titolo = "Cassa",
                Percorso = string.Empty,
                Icona = "PointOfSale",
                Visibile = true,
                Posizione = 2,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(cassaMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere Id
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaMenu, "Cassa", null, "PointOfSale", true, 2, null, null, superAdminRuolo, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaMenu);
            }
        }

        // Child: Lista Cassa
        var cassaChild1 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/list");

        if (cassaChild1 == null)
        {
            cassaChild1 = new Menu
            {
                Titolo = "Lista Cassa",
                Percorso = "/gestionale/cassa/list",
                Icona = "List",
                Visibile = true,
                Posizione = 2,
                NomeVista = "ListaRegistrazioneCassa",
                PercorsoFile = "registrazioneCassa/ListaRegistrazioneCassa.tsx",
                MenuPadre = cassaMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(cassaChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaChild1, "Lista Cassa", "/gestionale/cassa/list", "List", true, 2,
                "ListaRegistrazioneCassa", "registrazioneCassa/ListaRegistrazioneCassa.tsx", superAdminRuolo, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild1);
            }
        }

        // Child: Chiusura Mensile
        var cassaChild2 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/monthly-closure");

        if (cassaChild2 == null)
        {
            // Backwards compatibility: find and update old "Vista Mensile" menu
            cassaChild2 = await dbContext.Menus
                .Include(m => m.Ruoli)
                .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/monthly");

            if (cassaChild2 != null)
            {
                // Path is changing, so we update it
                cassaChild2.Percorso = "/gestionale/cassa/monthly-closure";
            }
        }


        if (cassaChild2 == null)
        {
            cassaChild2 = new Menu
            {
                Titolo = "Chiusura Mensile",
                Percorso = "/gestionale/cassa/monthly-closure",
                Icona = "CalendarMonth",
                Visibile = true,
                Posizione = 3,
                NomeVista = "MonthlyClosureList",
                PercorsoFile = "registrazioneCassa/MonthlyClosureList.tsx",
                MenuPadre = cassaMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(cassaChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaChild2, "Chiusura Mensile", "/gestionale/cassa/monthly-closure", "CalendarMonth", true, 3,
                "MonthlyClosureList", "registrazioneCassa/MonthlyClosureList.tsx", superAdminRuolo, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild2);
            }
        }

        // Remove old "Nuova Cassa" route if it exists (consolidated to /cassa/details)
        var oldNewCassaMenu = await dbContext.Menus
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/new");
        if (oldNewCassaMenu != null)
        {
            dbContext.Menus.Remove(oldNewCassaMenu);
            await dbContext.SaveChangesAsync();
        }

        // Child: Gestione Cassa (visible, for creating and editing cash registers with day navigation)
        var cassaChild4 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/cassa/details");

        if (cassaChild4 == null)
        {
            cassaChild4 = new Menu
            {
                Titolo = "Gestione Cassa",
                Percorso = "/gestionale/cassa/details",
                Icona = "Edit",
                Visibile = true,
                Posizione = 4,
                NomeVista = "RegistroCassaDetails",
                PercorsoFile = "registrazioneCassa/RegistroCassaDetails.tsx",
                MenuPadre = cassaMenu,
                Ruoli = [superAdminRuolo]
            };
            dbContext.Menus.Add(cassaChild4);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaChild4, "Gestione Cassa", "/gestionale/cassa/details", "Edit", true, 4,
                "RegistroCassaDetails", "registrazioneCassa/RegistroCassaDetails.tsx", superAdminRuolo, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild4);
            }
        }

        // ========================================
        // Menu Fornitori
        // ========================================
        var fornitoriMenu = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Fornitori" && m.Percorso == string.Empty);

        if (fornitoriMenu == null)
        {
            fornitoriMenu = new Menu
            {
                Titolo = "Fornitori",
                Percorso = string.Empty,
                Icona = "Store",
                Visibile = true,
                Posizione = 3,
                NomeVista = string.Empty,
                PercorsoFile = string.Empty,
                MenuPadreId = null
            };
            fornitoriMenu.Ruoli.Add(superAdminRuolo);
            dbContext.Menus.Add(fornitoriMenu);
            await dbContext.SaveChangesAsync();
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriMenu, "Fornitori", string.Empty, "Store", true, 3,
                string.Empty, string.Empty, superAdminRuolo, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriMenu);
                await dbContext.SaveChangesAsync();
            }
        }

        // Menu figlio: Lista Fornitori
        var fornitoriChild1 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Lista Fornitori" && m.MenuPadreId == fornitoriMenu.Id);

        if (fornitoriChild1 == null)
        {
            fornitoriChild1 = new Menu
            {
                Titolo = "Lista Fornitori",
                Percorso = "/gestionale/suppliers-list",
                Icona = "List",
                Visibile = true,
                Posizione = 1,
                NomeVista = "SupplierList",
                PercorsoFile = "suppliers/SupplierList.tsx",
                MenuPadreId = fornitoriMenu.Id
            };
            fornitoriChild1.Ruoli.Add(superAdminRuolo);
            dbContext.Menus.Add(fornitoriChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild1, "Lista Fornitori", "/gestionale/suppliers-list", "List", true, 1,
                "SupplierList", "suppliers/SupplierList.tsx", superAdminRuolo, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild1);
            }
        }

        // Menu figlio: Gestione Fornitori
        var fornitoriChild2 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Gestione Fornitori" && m.MenuPadreId == fornitoriMenu.Id);

        if (fornitoriChild2 == null)
        {
            fornitoriChild2 = new Menu
            {
                Titolo = "Gestione Fornitori",
                Percorso = "/gestionale/suppliers-details",
                Icona = "Person3",
                Visibile = true,
                Posizione = 2,
                NomeVista = "SupplierDetails",
                PercorsoFile = "suppliers/SupplierDetails.tsx",
                MenuPadreId = fornitoriMenu.Id
            };
            fornitoriChild2.Ruoli.Add(superAdminRuolo);
            dbContext.Menus.Add(fornitoriChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild2, "Gestione Fornitori", "/gestionale/suppliers-details", "Person3", true, 2,
                "SupplierDetails", "suppliers/SupplierDetails.tsx", superAdminRuolo, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild2);
            }
        }

        // Menu figlio: Fatture Acquisto
        var fornitoriChild3 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Fatture Acquisto" && m.MenuPadreId == fornitoriMenu.Id);

        if (fornitoriChild3 == null)
        {
            fornitoriChild3 = new Menu
            {
                Titolo = "Fatture Acquisto",
                Percorso = "/gestionale/purchase-invoices-list",
                Icona = "Receipt",
                Visibile = true,
                Posizione = 3,
                NomeVista = "PurchaseInvoiceList",
                PercorsoFile = "purchases/PurchaseInvoiceList.tsx",
                MenuPadreId = fornitoriMenu.Id
            };
            fornitoriChild3.Ruoli.Add(superAdminRuolo);
            dbContext.Menus.Add(fornitoriChild3);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild3, "Fatture Acquisto", "/gestionale/purchase-invoices-list", "Receipt", true, 3,
                "PurchaseInvoiceList", "purchases/PurchaseInvoiceList.tsx", superAdminRuolo, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild3);
            }
        }

        // Menu figlio: Gestione Fatture Acquisto
        var fornitoriChild4 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Titolo == "Gestione Fatture Acquisto" && m.MenuPadreId == fornitoriMenu.Id);

        if (fornitoriChild4 == null)
        {
            fornitoriChild4 = new Menu
            {
                Titolo = "Gestione Fatture Acquisto",
                Percorso = "/gestionale/purchase-invoices-details",
                Icona = "Edit",
                Visibile = true,
                Posizione = 4,
                NomeVista = "PurchaseInvoiceDetails",
                PercorsoFile = "purchases/PurchaseInvoiceDetails.tsx",
                MenuPadreId = fornitoriMenu.Id
            };
            fornitoriChild4.Ruoli.Add(superAdminRuolo);
            dbContext.Menus.Add(fornitoriChild4);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild4, "Gestione Fatture Acquisto", "/gestionale/purchase-invoices-details", "Edit", true, 4,
                "PurchaseInvoiceDetails", "purchases/PurchaseInvoiceDetails.tsx", superAdminRuolo, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild4);
            }
        }

        // Menu figlio: DDT
        var fornitoriChild5 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/delivery-notes-list");

        if (fornitoriChild5 == null)
        {
            fornitoriChild5 = new Menu
            {
                Titolo = "DDT",
                Percorso = "/gestionale/delivery-notes-list",
                Icona = "LocalShipping",
                Visibile = true,
                Posizione = 5,
                NomeVista = "DeliveryNoteList",
                PercorsoFile = "deliveryNotes/DeliveryNoteList.tsx",
                MenuPadreId = fornitoriMenu.Id
            };
            fornitoriChild5.Ruoli.Add(superAdminRuolo);
            dbContext.Menus.Add(fornitoriChild5);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild5, "DDT", "/gestionale/delivery-notes-list", "LocalShipping", true, 5,
                "DeliveryNoteList", "deliveryNotes/DeliveryNoteList.tsx", superAdminRuolo, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild5);
            }
        }

        // Menu figlio: Gestione DDT (nascosto nella sidebar)
        var fornitoriChild6 = await dbContext.Menus
            .Include(m => m.Ruoli)
            .FirstOrDefaultAsync(m => m.Percorso == "/gestionale/delivery-notes-details");

        if (fornitoriChild6 == null)
        {
            fornitoriChild6 = new Menu
            {
                Titolo = "Gestione DDT",
                Percorso = "/gestionale/delivery-notes-details",
                Icona = "Edit",
                Visibile = false,
                Posizione = 6,
                NomeVista = "DeliveryNoteDetails",
                PercorsoFile = "deliveryNotes/DeliveryNoteDetails.tsx",
                MenuPadreId = fornitoriMenu.Id
            };
            fornitoriChild6.Ruoli.Add(superAdminRuolo);
            dbContext.Menus.Add(fornitoriChild6);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild6, "Gestione DDT", "/gestionale/delivery-notes-details", "Edit", false, 6,
                "DeliveryNoteDetails", "deliveryNotes/DeliveryNoteDetails.tsx", superAdminRuolo, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild6);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
