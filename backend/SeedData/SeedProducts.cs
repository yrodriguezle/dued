using System.Globalization;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.SeedData;

public class SeedProducts
{
    /// <summary>
    /// Seeds products from the listino_products.csv file
    /// This reads from the CSV file and imports products into the database
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
            // Find the CSV file by searching from the project root
            // Try multiple possible locations to handle different runtime contexts
            string? csvPath = null;

            // Try 1: Direct path from current directory (when running via dotnet run)
            var attempts = new[]
            {
                Path.Combine(Directory.GetCurrentDirectory(), "listino_products.csv"),
                Path.Combine(AppContext.BaseDirectory, "listino_products.csv"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "listino_products.csv"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "listino_products.csv"),
            };

            foreach (var attempt in attempts)
            {
                var fullPath = Path.GetFullPath(attempt);
                if (File.Exists(fullPath))
                {
                    csvPath = fullPath;
                    break;
                }
            }

            if (csvPath == null)
            {
                Console.WriteLine($"WARNING: CSV file not found in any expected location. Tried:");
                foreach (var attempt in attempts)
                {
                    Console.WriteLine($"  - {Path.GetFullPath(attempt)}");
                }
                return;
            }

            Console.WriteLine($"Reading products from: {csvPath}");

            var products = ReadProductsFromCsv(csvPath);

            if (products.Count == 0)
            {
                Console.WriteLine("No products found in CSV file.");
                return;
            }

            // Add products to database
            await dbContext.Products.AddRangeAsync(products);
            await dbContext.SaveChangesAsync();

            Console.WriteLine($"Successfully seeded {products.Count} products from CSV");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR seeding products: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            throw;
        }
    }

    /// <summary>
    /// Reads products from the CSV file
    /// CSV format: Numero,Codice,Nome,Prezzo,Categoria
    /// </summary>
    private static List<Product> ReadProductsFromCsv(string filePath)
    {
        var products = new List<Product>();

        try
        {
            var lines = File.ReadAllLines(filePath);

            // Skip header row (Numero,Codice,Nome,Prezzo,Categoria)
            for (int i = 1; i < lines.Length; i++)
            {
                var line = lines[i].Trim();

                if (string.IsNullOrWhiteSpace(line))
                    continue;

                try
                {
                    var parts = ParseCsvLine(line);

                    if (parts.Count < 5)
                    {
                        Console.WriteLine($"WARNING: Row {i + 1} has fewer than 5 columns, skipping.");
                        continue;
                    }

                    var numero = parts[0].Trim();
                    var codice = parts[1].Trim().Trim('"');
                    var nome = parts[2].Trim().Trim('"');
                    var prezzoStr = parts[3].Trim();
                    var categoria = parts[4].Trim().Trim('"');

                    // Parse price - handle both "1,40" and "1.40" formats
                    if (!decimal.TryParse(prezzoStr.Replace(",", "."), NumberStyles.Any, CultureInfo.InvariantCulture, out var prezzo))
                    {
                        Console.WriteLine($"WARNING: Could not parse price '{prezzoStr}' for product {codice}, skipping.");
                        continue;
                    }

                    var product = new Product
                    {
                        Code = codice,
                        Name = nome,
                        Price = prezzo,
                        Category = categoria,
                        UnitOfMeasure = "pz",
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    products.Add(product);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"WARNING: Error parsing row {i + 1}: {ex.Message}");
                    continue;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR reading CSV file: {ex.Message}");
            throw;
        }

        return products;
    }

    /// <summary>
    /// Parses a CSV line respecting quoted fields
    /// </summary>
    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var currentField = "";
        var inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            var c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    // Escaped quote
                    currentField += '"';
                    i++;
                }
                else
                {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                // End of field
                result.Add(currentField);
                currentField = "";
            }
            else
            {
                currentField += c;
            }
        }

        // Add last field
        result.Add(currentField);

        return result;
    }
}
