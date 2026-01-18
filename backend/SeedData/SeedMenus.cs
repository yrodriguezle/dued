using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

public static class SeedMenus
{
    private static void UpdateMenuIfNeeded(Menu menu, string title, string? path, string icon, bool isVisible,
        int position, string? viewName, string? filePath, Role superAdminRole, Menu? parentMenu, ref bool needsUpdate)
    {
        if (menu.Title != title) { menu.Title = title; needsUpdate = true; }
        if (menu.Path != (path ?? string.Empty)) { menu.Path = path ?? string.Empty; needsUpdate = true; }
        if (menu.Icon != icon) { menu.Icon = icon; needsUpdate = true; }
        if (menu.IsVisible != isVisible) { menu.IsVisible = isVisible; needsUpdate = true; }
        if (menu.Position != position) { menu.Position = position; needsUpdate = true; }
        if (menu.ViewName != (viewName ?? string.Empty)) { menu.ViewName = viewName ?? string.Empty; needsUpdate = true; }
        if (menu.FilePath != (filePath ?? string.Empty)) { menu.FilePath = filePath ?? string.Empty; needsUpdate = true; }
        if (menu.ParentMenuId != parentMenu?.MenuId) { menu.ParentMenu = parentMenu; needsUpdate = true; }

        if (!menu.Roles.Any(r => r.RoleId == superAdminRole.RoleId))
        {
            menu.Roles.Add(superAdminRole);
            needsUpdate = true;
        }
    }

    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Role? superAdminRole = await dbContext.Roles
            .Include(r => r.Menus)
            .FirstOrDefaultAsync(r => r.RoleName == "SuperAdmin");
        if (superAdminRole == null)
        {
            return;
        }

        // Clean up duplicate Dashboard menus (keep only one with correct path and filePath)
        var dashboardMenus = await dbContext.Menus
            .Where(m => m.Title == "Dashboard" && m.ParentMenuId == null)
            .ToListAsync();

        if (dashboardMenus.Count > 1)
        {
            // Keep the one with the correct path, remove others
            var correctDashboard = dashboardMenus.FirstOrDefault(m => m.Path == "/gestionale/dashboard");
            var toRemove = dashboardMenus.Where(m => m != correctDashboard).ToList();

            foreach (var menu in toRemove)
            {
                dbContext.Menus.Remove(menu);
            }

            await dbContext.SaveChangesAsync();
        }

        // First, try to find existing dashboard menu by path
        var dashboardMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/dashboard");

        // If not found, try to find by title (for backwards compatibility with old seed data)
        dashboardMenu ??= await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Dashboard" && m.ParentMenuId == null);

        if (dashboardMenu == null)
        {
            dashboardMenu = new Menu
            {
                Title = "Dashboard",
                Path = "/gestionale/dashboard",
                Icon = "Dashboard",
                IsVisible = true,
                Position = 1,
                ViewName = "HomePage",
                FilePath = "dashboard/HomePage.tsx",
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(dashboardMenu);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(dashboardMenu, "Dashboard", "/gestionale/dashboard", "Dashboard", true, 1,
                "HomePage", "dashboard/HomePage.tsx", superAdminRole, null, ref needsUpdate);

            if (needsUpdate)
            {
                dbContext.Menus.Update(dashboardMenu);
            }
        }

        // Menu padre Utenti (senza path)
        var utentiMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Utenti" && m.Path == string.Empty);

        if (utentiMenu == null)
        {
            utentiMenu = new Menu
            {
                Title = "Utenti",
                Path = string.Empty,
                Icon = "Group",
                IsVisible = true,
                Position = 3,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(utentiMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere MenuId
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(utentiMenu, "Utenti", null, "Group", true, 3, null, null, superAdminRole, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(utentiMenu);
            }
        }

        // Child: Lista utenti
        var utentiChild1 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/users-list");

        if (utentiChild1 == null)
        {
            utentiChild1 = new Menu
            {
                Title = "Lista utenti",
                Path = "/gestionale/users-list",
                Icon = string.Empty,
                IsVisible = true,
                Position = 1,
                ViewName = "UserList",
                FilePath = "users/UserList.tsx",
                ParentMenu = utentiMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(utentiChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(utentiChild1, "Lista utenti", "/gestionale/users-list", string.Empty, true, 1,
                "UserList", "users/UserList.tsx", superAdminRole, utentiMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(utentiChild1);
            }
        }

        // Child: Gestione utenti
        var utentiChild2 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/users-details");

        if (utentiChild2 == null)
        {
            utentiChild2 = new Menu
            {
                Title = "Gestione utenti",
                Path = "/gestionale/users-details",
                Icon = string.Empty,
                IsVisible = true,
                Position = 2,
                ViewName = "UserDetails",
                FilePath = "users/UserDetails.tsx",
                ParentMenu = utentiMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(utentiChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(utentiChild2, "Gestione utenti", "/gestionale/users-details", string.Empty, true, 2,
                "UserDetails", "users/UserDetails.tsx", superAdminRole, utentiMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(utentiChild2);
            }
        }

        // Menu padre Ruoli (senza path)
        var ruoliMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Ruoli" && m.Path == string.Empty);

        if (ruoliMenu == null)
        {
            ruoliMenu = new Menu
            {
                Title = "Ruoli",
                Path = string.Empty,
                Icon = "Engineering",
                IsVisible = true,
                Position = 4,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(ruoliMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere MenuId
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(ruoliMenu, "Ruoli", null, "Engineering", true, 4, null, null, superAdminRole, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(ruoliMenu);
            }
        }

        // Child: Lista ruoli
        var ruoliChild1 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/roles-list");

        if (ruoliChild1 == null)
        {
            ruoliChild1 = new Menu
            {
                Title = "Lista ruoli",
                Path = "/gestionale/roles-list",
                Icon = string.Empty,
                IsVisible = true,
                Position = 1,
                ViewName = "RoleList",
                FilePath = "roles/RoleList.tsx",
                ParentMenu = ruoliMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(ruoliChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(ruoliChild1, "Lista ruoli", "/gestionale/roles-list", string.Empty, true, 1,
                "RoleList", "roles/RoleList.tsx", superAdminRole, ruoliMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(ruoliChild1);
            }
        }

        // Child: Gestione ruoli
        var ruoliChild2 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/roles-details");

        if (ruoliChild2 == null)
        {
            ruoliChild2 = new Menu
            {
                Title = "Gestione ruoli",
                Path = "/gestionale/roles-details",
                Icon = string.Empty,
                IsVisible = true,
                Position = 2,
                ViewName = "RoleDetails",
                FilePath = "roles/RoleDetails.tsx",
                ParentMenu = ruoliMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(ruoliChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(ruoliChild2, "Gestione ruoli", "/gestionale/roles-details", string.Empty, true, 2,
                "RoleDetails", "roles/RoleDetails.tsx", superAdminRole, ruoliMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(ruoliChild2);
            }
        }

        // Menu padre Menù (senza path)
        var menusMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Menù" && m.Path == string.Empty);

        if (menusMenu == null)
        {
            menusMenu = new Menu
            {
                Title = "Menù",
                Path = string.Empty,
                Icon = "List",
                IsVisible = true,
                Position = 5,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(menusMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere MenuId
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(menusMenu, "Menù", null, "List", true, 5, null, null, superAdminRole, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(menusMenu);
            }
        }

        // Child: Lista menù
        var menusChild1 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/menus-list");

        if (menusChild1 == null)
        {
            menusChild1 = new Menu
            {
                Title = "List menù",
                Path = "/gestionale/menus-list",
                Icon = string.Empty,
                IsVisible = true,
                Position = 1,
                ViewName = "MenuList",
                FilePath = "menu/MenuList.tsx",
                ParentMenu = menusMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(menusChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(menusChild1, "List menù", "/gestionale/menus-list", string.Empty, true, 1,
                "MenuList", "menu/MenuList.tsx", superAdminRole, menusMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(menusChild1);
            }
        }

        // Child: Gestione menù
        var menusChild2 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/menus-details");

        if (menusChild2 == null)
        {
            menusChild2 = new Menu
            {
                Title = "Gestione menù",
                Path = "/gestionale/menus-details",
                Icon = string.Empty,
                IsVisible = true,
                Position = 2,
                ViewName = "MenuDetails",
                FilePath = "menu/MenuDetails.tsx",
                ParentMenu = menusMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(menusChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(menusChild2, "Gestione menù", "/gestionale/menus-details", string.Empty, true, 2,
                "MenuDetails", "menu/MenuDetails.tsx", superAdminRole, menusMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(menusChild2);
            }
        }

        // Menu Impostazioni
        var settingsMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/settings");

        if (settingsMenu == null)
        {
            settingsMenu = new Menu
            {
                Title = "Impostazioni",
                Path = "/gestionale/settings",
                Icon = "Settings",
                IsVisible = true,
                Position = 6,
                ViewName = "SettingsDetails",
                FilePath = "settings/SettingsDetails.tsx",
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(settingsMenu);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(settingsMenu, "Impostazioni", "/gestionale/settings", "Settings", true, 6,
                "SettingsDetails", "settings/SettingsDetails.tsx", superAdminRole, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(settingsMenu);
            }
        }

        // Menu padre Cassa (senza path e FilePath - collapsible menu group)
        var cassaMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Cassa" && m.Path == string.Empty);

        if (cassaMenu == null)
        {
            // Try to find old Cassa menu by path and remove it if it exists
            var oldCassaMenu = await dbContext.Menus
                .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa");
            if (oldCassaMenu != null)
            {
                dbContext.Menus.Remove(oldCassaMenu);
                await dbContext.SaveChangesAsync();
            }

            cassaMenu = new Menu
            {
                Title = "Cassa",
                Path = string.Empty,
                Icon = "PointOfSale",
                IsVisible = true,
                Position = 2,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(cassaMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere MenuId
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaMenu, "Cassa", null, "PointOfSale", true, 2, null, null, superAdminRole, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaMenu);
            }
        }

        // Child: Lista Cassa
        var cassaChild1 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa/list");

        if (cassaChild1 == null)
        {
            cassaChild1 = new Menu
            {
                Title = "Lista Cassa",
                Path = "/gestionale/cassa/list",
                Icon = "List",
                IsVisible = true,
                Position = 2,
                ViewName = "CashRegisterList",
                FilePath = "cashRegister/CashRegisterList.tsx",
                ParentMenu = cassaMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(cassaChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaChild1, "Lista Cassa", "/gestionale/cassa/list", "List", true, 2,
                "CashRegisterList", "cashRegister/CashRegisterList.tsx", superAdminRole, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild1);
            }
        }

        // Child: Chiusura Mensile
        var cassaChild2 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa/monthly-closure");

        if (cassaChild2 == null)
        {
            // Backwards compatibility: find and update old "Vista Mensile" menu
            cassaChild2 = await dbContext.Menus
                .Include(m => m.Roles)
                .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa/monthly");

            if (cassaChild2 != null)
            {
                // Path is changing, so we update it
                cassaChild2.Path = "/gestionale/cassa/monthly-closure";
            }
        }


        if (cassaChild2 == null)
        {
            cassaChild2 = new Menu
            {
                Title = "Chiusura Mensile",
                Path = "/gestionale/cassa/monthly-closure",
                Icon = "CalendarMonth",
                IsVisible = true,
                Position = 3,
                ViewName = "MonthlyClosureList",
                FilePath = "cashRegister/MonthlyClosureList.tsx",
                ParentMenu = cassaMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(cassaChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaChild2, "Chiusura Mensile", "/gestionale/cassa/monthly-closure", "CalendarMonth", true, 3,
                "MonthlyClosureList", "cashRegister/MonthlyClosureList.tsx", superAdminRole, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild2);
            }
        }

        // Remove old "Nuova Cassa" route if it exists (consolidated to /cassa/details)
        var oldNewCassaMenu = await dbContext.Menus
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa/new");
        if (oldNewCassaMenu != null)
        {
            dbContext.Menus.Remove(oldNewCassaMenu);
            await dbContext.SaveChangesAsync();
        }

        // Child: Gestione Cassa (visible, for creating and editing cash registers with day navigation)
        var cassaChild4 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa/details");

        if (cassaChild4 == null)
        {
            cassaChild4 = new Menu
            {
                Title = "Gestione Cassa",
                Path = "/gestionale/cassa/details",
                Icon = "Edit",
                IsVisible = true,
                Position = 4,
                ViewName = "CashRegisterDetails",
                FilePath = "cashRegister/CashRegisterDetails.tsx",
                ParentMenu = cassaMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(cassaChild4);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaChild4, "Gestione Cassa", "/gestionale/cassa/details", "Edit", true, 4,
                "CashRegisterDetails", "cashRegister/CashRegisterDetails.tsx", superAdminRole, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild4);
            }
        }

        // ========================================
        // Menu Fornitori
        // ========================================
        var fornitoriMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Fornitori" && m.Path == string.Empty);

        if (fornitoriMenu == null)
        {
            fornitoriMenu = new Menu
            {
                Title = "Fornitori",
                Path = string.Empty,
                Icon = "Store",
                IsVisible = true,
                Position = 7,
                ViewName = string.Empty,
                FilePath = string.Empty,
                ParentMenuId = null
            };
            fornitoriMenu.Roles.Add(superAdminRole);
            dbContext.Menus.Add(fornitoriMenu);
            await dbContext.SaveChangesAsync();
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriMenu, "Fornitori", string.Empty, "Store", true, 7,
                string.Empty, string.Empty, superAdminRole, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriMenu);
                await dbContext.SaveChangesAsync();
            }
        }

        // Menu figlio: Lista Fornitori
        var fornitoriChild1 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Lista Fornitori" && m.ParentMenuId == fornitoriMenu.MenuId);

        if (fornitoriChild1 == null)
        {
            fornitoriChild1 = new Menu
            {
                Title = "Lista Fornitori",
                Path = "/gestionale/suppliers-list",
                Icon = "List",
                IsVisible = true,
                Position = 1,
                ViewName = "SupplierList",
                FilePath = "suppliers/SupplierList.tsx",
                ParentMenuId = fornitoriMenu.MenuId
            };
            fornitoriChild1.Roles.Add(superAdminRole);
            dbContext.Menus.Add(fornitoriChild1);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild1, "Lista Fornitori", "/gestionale/suppliers-list", "List", true, 1,
                "SupplierList", "suppliers/SupplierList.tsx", superAdminRole, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild1);
            }
        }

        // Menu figlio: Gestione Fornitori
        var fornitoriChild2 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Gestione Fornitori" && m.ParentMenuId == fornitoriMenu.MenuId);

        if (fornitoriChild2 == null)
        {
            fornitoriChild2 = new Menu
            {
                Title = "Gestione Fornitori",
                Path = "/gestionale/suppliers-details",
                Icon = "Edit",
                IsVisible = true,
                Position = 2,
                ViewName = "SupplierDetails",
                FilePath = "suppliers/SupplierDetails.tsx",
                ParentMenuId = fornitoriMenu.MenuId
            };
            fornitoriChild2.Roles.Add(superAdminRole);
            dbContext.Menus.Add(fornitoriChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild2, "Gestione Fornitori", "/gestionale/suppliers-details", "Edit", true, 2,
                "SupplierDetails", "suppliers/SupplierDetails.tsx", superAdminRole, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild2);
            }
        }

        // Menu figlio: Fatture Acquisto
        var fornitoriChild3 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Fatture Acquisto" && m.ParentMenuId == fornitoriMenu.MenuId);

        if (fornitoriChild3 == null)
        {
            fornitoriChild3 = new Menu
            {
                Title = "Fatture Acquisto",
                Path = "/gestionale/purchase-invoices-list",
                Icon = "Receipt",
                IsVisible = true,
                Position = 3,
                ViewName = "PurchaseInvoiceList",
                FilePath = "purchases/PurchaseInvoiceList.tsx",
                ParentMenuId = fornitoriMenu.MenuId
            };
            fornitoriChild3.Roles.Add(superAdminRole);
            dbContext.Menus.Add(fornitoriChild3);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild3, "Fatture Acquisto", "/gestionale/purchase-invoices-list", "Receipt", true, 3,
                "PurchaseInvoiceList", "purchases/PurchaseInvoiceList.tsx", superAdminRole, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild3);
            }
        }

        // Menu figlio: Gestione Fatture Acquisto
        var fornitoriChild4 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Title == "Gestione Fatture Acquisto" && m.ParentMenuId == fornitoriMenu.MenuId);

        if (fornitoriChild4 == null)
        {
            fornitoriChild4 = new Menu
            {
                Title = "Gestione Fatture Acquisto",
                Path = "/gestionale/purchase-invoices-details",
                Icon = "Edit",
                IsVisible = true,
                Position = 4,
                ViewName = "PurchaseInvoiceDetails",
                FilePath = "purchases/PurchaseInvoiceDetails.tsx",
                ParentMenuId = fornitoriMenu.MenuId
            };
            fornitoriChild4.Roles.Add(superAdminRole);
            dbContext.Menus.Add(fornitoriChild4);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(fornitoriChild4, "Gestione Fatture Acquisto", "/gestionale/purchase-invoices-details", "Edit", true, 4,
                "PurchaseInvoiceDetails", "purchases/PurchaseInvoiceDetails.tsx", superAdminRole, fornitoriMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(fornitoriChild4);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
