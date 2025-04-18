﻿using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using Microsoft.Extensions.DependencyInjection;

namespace duedgusto.SeedData;

public static class SeedMenus
{
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        AppDbContext dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Role? superAdminRole = await dbContext.Roles
            .Include(r => r.Menus)
            .FirstOrDefaultAsync(r => r.RoleName == "SuperAdmin");
        if (superAdminRole == null || superAdminRole.Menus.Any())
        {
            return;
        }

        if (!await dbContext.Menus.AnyAsync(m => m.Path == "/gestionale/dashboard"))
        {
            var dashboardMenu = new Menu
            {
                Title = "Dashboard",
                Path = "/gestionale",
                Icon = "Dashboard",
                IsVisible = true,
                ViewName = "Dashboard",
                FilePath = "dashboard",
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(dashboardMenu);
        }

        if (!await dbContext.Menus.AnyAsync(m => m.Path == "/gestionale/users"))
        {
            var utentiMenu = new Menu
            {
                Title = "Utenti",
                Path = string.Empty,
                Icon = "Group",
                IsVisible = true,
                Roles = [superAdminRole]
            };

            var utentiChild1 = new Menu
            {
                Title = "Lista utenti",
                Path = "/gestionale/users-list",
                Icon = string.Empty,
                IsVisible = true,
                ViewName = "UserList",
                FilePath = "users",
                ParentMenu = utentiMenu,
                Roles = [superAdminRole]
            };

            var utentiChild2 = new Menu
            {
                Title = "Gestione utenti",
                Path = "/gestionale/users-details",
                Icon = string.Empty,
                IsVisible = true,
                ViewName = "UserDetails",
                FilePath = "users",
                ParentMenu = utentiMenu,
                Roles = [superAdminRole]
            };

            dbContext.Menus.Add(utentiMenu);
            dbContext.Menus.Add(utentiChild1);
            dbContext.Menus.Add(utentiChild2);
        }

        if (!await dbContext.Menus.AnyAsync(m => m.Path == "/gestionale/roles"))
        {
            var ruoliMenu = new Menu
            {
                Title = "Ruoli",
                Path = string.Empty,
                Icon = "Engineering",
                IsVisible = true,
                Roles = [superAdminRole]
            };

            var ruoliChild1 = new Menu
            {
                Title = "Lista ruoli",
                Path = "/gestionale/roles-list",
                Icon = string.Empty,
                IsVisible = true,
                ViewName = "RoleList",
                FilePath = "roles",
                ParentMenu = ruoliMenu,
                Roles = [superAdminRole]
            };

            var ruoliChild2 = new Menu
            {
                Title = "Gestione ruoli",
                Path = "/gestionale/roles-details",
                Icon = string.Empty,
                IsVisible = true,
                ViewName = "RoleDetails",
                FilePath = "roles",
                ParentMenu = ruoliMenu,
                Roles = [superAdminRole]
            };

            dbContext.Menus.Add(ruoliMenu);
            dbContext.Menus.Add(ruoliChild1);
            dbContext.Menus.Add(ruoliChild2);
        }

        if (!await dbContext.Menus.AnyAsync(m => m.Path == "/gestionale/menus"))
        {
            var menusMenu = new Menu
            {
                Title = "Menù",
                Path = string.Empty,
                Icon = "List",
                IsVisible = true,
                Roles = [superAdminRole]
            };

            var menusChild1 = new Menu
            {
                Title = "List menù",
                Path = "/gestionale/menus-list",
                Icon = string.Empty,
                IsVisible = true,
                ViewName = "MenuList",
                FilePath = "menu",
                ParentMenu = menusMenu,
                Roles = [superAdminRole]
            };

            var menusChild2 = new Menu
            {
                Title = "Gestione menù",
                Path = "/gestionale/menus-details",
                Icon = string.Empty,
                IsVisible = true,
                ViewName = "MenuDetails",
                FilePath = "menu",
                ParentMenu = menusMenu,
                Roles = [superAdminRole]
            };

            dbContext.Menus.Add(menusMenu);
            dbContext.Menus.Add(menusChild1);
            dbContext.Menus.Add(menusChild2);
        }

        if (!await dbContext.Menus.AnyAsync(m => m.Path == "/gestionale/settings"))
        {
            var settingsMenu = new Menu
            {
                Title = "Impostazioni",
                Path = "/gestionale/settings",
                Icon = "Settings",
                IsVisible = true,
                ViewName = "SettingsDetails",
                FilePath = "settings",
                Roles = [superAdminRole]
            };
            dbContext.Menus.Add(settingsMenu);
        }

        await dbContext.SaveChangesAsync();
    }
}
