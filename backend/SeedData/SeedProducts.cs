using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

public class SeedProducts
{
    /// <summary>
    /// Seeds products from the specifiche-progetto.xlsx file (Listino sheet)
    /// This reads from the frontend XLSX file and imports products into the database
    /// </summary>
    public static async Task Initialize(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Check if products already exist
        if (await dbContext.Products.AnyAsync())
        {
            Console.WriteLine("Products already seeded, skipping...");
            return;
        }

        try
        {
            // Path to the XLSX file in the frontend directory
            var xlsxPath = Path.Combine(
                AppContext.BaseDirectory,
                "..", "..", "duedgusto", "specifiche-progetto.xlsx"
            );

            // Normalize and check if file exists
            xlsxPath = Path.GetFullPath(xlsxPath);

            if (!File.Exists(xlsxPath))
            {
                Console.WriteLine($"WARNING: XLSX file not found at {xlsxPath}. Skipping product seeding.");
                return;
            }

            Console.WriteLine($"Reading products from: {xlsxPath}");

            var products = ReadProductsFromXlsx(xlsxPath);

            if (products.Count == 0)
            {
                Console.WriteLine("No products found in XLSX file.");
                return;
            }

            // Add products to database
            await dbContext.Products.AddRangeAsync(products);
            await dbContext.SaveChangesAsync();

            Console.WriteLine($"Successfully seeded {products.Count} products from XLSX");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR seeding products: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            throw;
        }
    }

    /// <summary>
    /// Reads products from the "Listino" sheet in the XLSX file
    /// Expected columns: Code, Name, Price, Category, UnitOfMeasure, Description (optional)
    /// </summary>
    private static List<Product> ReadProductsFromXlsx(string filePath)
    {
        var products = new List<Product>();

        using var workbook = new XLWorkbook(filePath);

        // Get the "Listino" sheet
        var worksheet = workbook.Worksheet("Listino");
        if (worksheet == null)
        {
            Console.WriteLine("WARNING: 'Listino' sheet not found in XLSX");
            return products;
        }

        var rows = worksheet.RangeUsed().RowsUsed().Skip(1); // Skip header row

        foreach (var row in rows)
        {
            try
            {
                // Read cells with error handling for missing/empty cells
                var code = GetCellValue(row, 1)?.Trim();
                var name = GetCellValue(row, 2)?.Trim();
                var priceStr = GetCellValue(row, 3)?.Trim();
                var category = GetCellValue(row, 4)?.Trim();
                var unitOfMeasure = GetCellValue(row, 5)?.Trim() ?? "pz";
                var description = GetCellValue(row, 6)?.Trim();

                // Skip empty rows
                if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                // Parse price
                if (!decimal.TryParse(priceStr, out var price))
                {
                    Console.WriteLine($"WARNING: Invalid price '{priceStr}' for product {code}");
                    price = 0m;
                }

                var product = new Product
                {
                    Code = code,
                    Name = name,
                    Price = price,
                    Category = category,
                    UnitOfMeasure = unitOfMeasure,
                    Description = description,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                products.Add(product);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: Error reading row {row.RowNumber()}: {ex.Message}");
                continue;
            }
        }

        return products;
    }

    /// <summary>
    /// Gets the value from a cell, handling nulls and empty cells gracefully
    /// </summary>
    private static string? GetCellValue(IXLRangeRow row, int columnNumber)
    {
        try
        {
            var cell = row.Cell(columnNumber);
            if (cell == null || cell.IsEmpty())
            {
                return null;
            }

            var value = cell.Value;
            if (value.IsBlank)
            {
                return null;
            }

            var strValue = value.ToString();
            return string.IsNullOrWhiteSpace(strValue) ? null : strValue;
        }
        catch
        {
            return null;
        }
    }
}
