using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.SeedData;

public static class SeedMenus
{
    private static void UpdateMenuIfNeeded(Menu menu, string title, string? path, string icon, bool isVisible,
        string? viewName, string? filePath, Role superAdminRole, Menu? parentMenu, ref bool needsUpdate)
    {
        if (menu.Title != title) { menu.Title = title; needsUpdate = true; }
        if (menu.Path != (path ?? string.Empty)) { menu.Path = path ?? string.Empty; needsUpdate = true; }
        if (menu.Icon != icon) { menu.Icon = icon; needsUpdate = true; }
        if (menu.IsVisible != isVisible) { menu.IsVisible = isVisible; needsUpdate = true; }
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

        var dashboardMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/dashboard");

        if (dashboardMenu == null)
        {
            dashboardMenu = new Menu
            {
                Title = "Dashboard",
                Path = "/gestionale/dashboard",
                Icon = "Dashboard",
                IsVisible = true,
                ViewName = "Dashboard",
                FilePath = "dashboard/Dashboard.tsx",
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(dashboardMenu);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(dashboardMenu, "Dashboard", "/gestionale/dashboard", "Dashboard", true,
                "Dashboard", "dashboard/Dashboard.tsx", superAdminRole, null, ref needsUpdate);

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
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(utentiMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere MenuId
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(utentiMenu, "Utenti", null, "Group", true, null, null, superAdminRole, null, ref needsUpdate);
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
            UpdateMenuIfNeeded(utentiChild1, "Lista utenti", "/gestionale/users-list", string.Empty, true,
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
            UpdateMenuIfNeeded(utentiChild2, "Gestione utenti", "/gestionale/users-details", string.Empty, true,
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
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(ruoliMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere MenuId
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(ruoliMenu, "Ruoli", null, "Engineering", true, null, null, superAdminRole, null, ref needsUpdate);
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
            UpdateMenuIfNeeded(ruoliChild1, "Lista ruoli", "/gestionale/roles-list", string.Empty, true,
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
            UpdateMenuIfNeeded(ruoliChild2, "Gestione ruoli", "/gestionale/roles-details", string.Empty, true,
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
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(menusMenu);
            await dbContext.SaveChangesAsync(); // Save per ottenere MenuId
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(menusMenu, "Menù", null, "List", true, null, null, superAdminRole, null, ref needsUpdate);
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
            UpdateMenuIfNeeded(menusChild1, "List menù", "/gestionale/menus-list", string.Empty, true,
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
            UpdateMenuIfNeeded(menusChild2, "Gestione menù", "/gestionale/menus-details", string.Empty, true,
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
                ViewName = "SettingsDetails",
                FilePath = "settings/SettingsDetails.tsx",
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(settingsMenu);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(settingsMenu, "Impostazioni", "/gestionale/settings", "Settings", true,
                "SettingsDetails", "settings/SettingsDetails.tsx", superAdminRole, null, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(settingsMenu);
            }
        }

        // Menu Cassa (Dashboard)
        var cassaMenu = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa");

        if (cassaMenu == null)
        {
            cassaMenu = new Menu
            {
                Title = "Cassa",
                Path = "/gestionale/cassa",
                Icon = "PointOfSale",
                IsVisible = true,
                ViewName = "CashRegisterDashboard",
                FilePath = "cashRegister/CashRegisterDashboard.tsx",
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(cassaMenu);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaMenu, "Cassa", "/gestionale/cassa", "PointOfSale", true,
                "CashRegisterDashboard", "cashRegister/CashRegisterDashboard.tsx", superAdminRole, null, ref needsUpdate);
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
            UpdateMenuIfNeeded(cassaChild1, "Lista Cassa", "/gestionale/cassa/list", "List", true,
                "CashRegisterList", "cashRegister/CashRegisterList.tsx", superAdminRole, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild1);
            }
        }

        // Child: Vista Mensile
        var cassaChild2 = await dbContext.Menus
            .Include(m => m.Roles)
            .FirstOrDefaultAsync(m => m.Path == "/gestionale/cassa/monthly");

        if (cassaChild2 == null)
        {
            cassaChild2 = new Menu
            {
                Title = "Vista Mensile",
                Path = "/gestionale/cassa/monthly",
                Icon = "CalendarMonth",
                IsVisible = true,
                ViewName = "MonthlyView",
                FilePath = "cashRegister/MonthlyView.tsx",
                ParentMenu = cassaMenu,
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(cassaChild2);
        }
        else
        {
            bool needsUpdate = false;
            UpdateMenuIfNeeded(cassaChild2, "Vista Mensile", "/gestionale/cassa/monthly", "CalendarMonth", true,
                "MonthlyView", "cashRegister/MonthlyView.tsx", superAdminRole, cassaMenu, ref needsUpdate);
            if (needsUpdate)
            {
                dbContext.Menus.Update(cassaChild2);
            }
        }

        await dbContext.SaveChangesAsync();
    }
}
