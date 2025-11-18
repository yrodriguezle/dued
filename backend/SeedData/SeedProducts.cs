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
    /// The Listino sheet has multiple columns with products and prices:
    /// - Columns A-B: First category (name in A, price in B)
    /// - Columns D-E: Second category (name in D, price in E)
    /// - Columns H-I: Third category (name in H, price in I)
    /// Categories are intelligently determined based on product names
    /// </summary>
    private static List<Product> ReadProductsFromXlsx(string filePath)
    {
        var products = new List<Product>();
        var addedCodes = new HashSet<string>(); // Track added products to avoid duplicates

        using var workbook = new XLWorkbook(filePath);

        // Get the "Listino" sheet
        var worksheet = workbook.Worksheet("Listino");
        if (worksheet == null)
        {
            Console.WriteLine("WARNING: 'Listino' sheet not found in XLSX");
            return products;
        }

        var rows = worksheet.RangeUsed().RowsUsed();

        foreach (var row in rows)
        {
            try
            {
                // Read from column A (name) and B (price)
                var name_A = GetCellValue(row, 1)?.Trim();
                var price_A_Str = GetCellValue(row, 2)?.Trim();

                if (!string.IsNullOrWhiteSpace(name_A) && !string.IsNullOrWhiteSpace(price_A_Str))
                {
                    if (decimal.TryParse(price_A_Str.Replace(",", "."), out var price_A))
                    {
                        var code = $"PROD_{products.Count + 1:D3}";
                        var category = DetermineCategoryByName(name_A);
                        var product = new Product
                        {
                            Code = code,
                            Name = name_A,
                            Price = price_A,
                            Category = category,
                            UnitOfMeasure = "pz",
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        products.Add(product);
                    }
                }

                // Read from column D (name) and E (price)
                var name_D = GetCellValue(row, 4)?.Trim();
                var price_D_Str = GetCellValue(row, 5)?.Trim();

                if (!string.IsNullOrWhiteSpace(name_D) && !string.IsNullOrWhiteSpace(price_D_Str))
                {
                    if (decimal.TryParse(price_D_Str.Replace(",", "."), out var price_D))
                    {
                        var code = $"PROD_{products.Count + 1:D3}";
                        var category = DetermineCategoryByName(name_D);
                        var product = new Product
                        {
                            Code = code,
                            Name = name_D,
                            Price = price_D,
                            Category = category,
                            UnitOfMeasure = "pz",
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        products.Add(product);
                    }
                }

                // Read from column H (name) and I (price)
                var name_H = GetCellValue(row, 8)?.Trim();
                var price_H_Str = GetCellValue(row, 9)?.Trim();

                if (!string.IsNullOrWhiteSpace(name_H) && !string.IsNullOrWhiteSpace(price_H_Str))
                {
                    if (decimal.TryParse(price_H_Str.Replace(",", "."), out var price_H))
                    {
                        var code = $"PROD_{products.Count + 1:D3}";
                        var category = DetermineCategoryByName(name_H);
                        var product = new Product
                        {
                            Code = code,
                            Name = name_H,
                            Price = price_H,
                            Category = category,
                            UnitOfMeasure = "pz",
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        products.Add(product);
                    }
                }
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
    /// Intelligently determines product category based on product name
    /// Uses keyword matching to classify products into predefined categories
    /// </summary>
    private static string DetermineCategoryByName(string name)
    {
        var nameLower = name.ToLower();

        // DOLCI/BRIOCHES
        if (nameLower.Contains("brioches") || nameLower.Contains("vuota") ||
            nameLower.Contains("crema") || nameLower.Contains("albicocca") ||
            nameLower.Contains("krapfen") || nameLower.Contains("strudel") ||
            nameLower.Contains("nutella") || nameLower.Contains("pistacchio") ||
            nameLower.Contains("frutti") || nameLower.Contains("fagottino") ||
            nameLower.Contains("conchiglia") || nameLower.Contains("treccia") ||
            nameLower.Contains("mini") || nameLower.Contains("vegana"))
            return "Dolci";

        // CAFFÈ
        if (nameLower.Contains("espresso") || nameLower.Contains("caffè") ||
            nameLower.Contains("caffe") || nameLower.Contains("americano") ||
            nameLower.Contains("cappuccino") || nameLower.Contains("macchiato") ||
            nameLower.Contains("moccacino") || nameLower.Contains("orzo") ||
            nameLower.Contains("corretto") || nameLower.Contains("shakerato") ||
            nameLower.Contains("deca") || nameLower.Contains("decafeinato") ||
            nameLower.Contains("ginseng") || nameLower.Contains("crema caffe") ||
            nameLower.Contains("latte") || nameLower.Contains("cioccolata"))
            return "Caffè";

        // BIRRA
        if (nameLower.Contains("ganter") || nameLower.Contains("engel") ||
            nameLower.Contains("corona") || nameLower.Contains("beck") ||
            nameLower.Contains("radler") || nameLower.Contains("birra") ||
            nameLower.Contains("edit"))
            return "Birra";

        // VINO
        if (nameLower.Contains("custoza") || nameLower.Contains("lugana") ||
            nameLower.Contains("soraghe") || nameLower.Contains("maculan") ||
            nameLower.Contains("vino") || nameLower.Contains("prosecco") ||
            nameLower.Contains("brut") || nameLower.Contains("docg") ||
            nameLower.Contains("doc") || nameLower.Contains("rosè") ||
            nameLower.Contains("spina"))
            return "Vino";

        // APERITIVO E COCKTAIL
        if (nameLower.Contains("spritz") || nameLower.Contains("aperol") ||
            nameLower.Contains("campari") || nameLower.Contains("campari soda") ||
            nameLower.Contains("gin tonic") || nameLower.Contains("jägerbomb") ||
            nameLower.Contains("mojito") || nameLower.Contains("amaro") ||
            nameLower.Contains("grappa") || nameLower.Contains("alcolico") ||
            nameLower.Contains("analcolico"))
            return "Aperitivo";

        // BIBITE
        if (nameLower.Contains("redbull") || nameLower.Contains("coca") ||
            nameLower.Contains("fanta") || nameLower.Contains("acqua") ||
            nameLower.Contains("chinotto") || nameLower.Contains("succo") ||
            nameLower.Contains("acqua tonica") || nameLower.Contains("infusi") ||
            nameLower.Contains("te") || nameLower.Contains("bibite") ||
            nameLower.Contains("lattina") || nameLower.Contains("sciroppo") ||
            nameLower.Contains("spremu") || nameLower.Contains("menta"))
            return "Bibite";

        // CUCINA
        if (nameLower.Contains("insalata") || nameLower.Contains("panini") ||
            nameLower.Contains("pane") || nameLower.Contains("panino") ||
            nameLower.Contains("schiaciata") || nameLower.Contains("capresse") ||
            nameLower.Contains("paninetti") || nameLower.Contains("riso") ||
            nameLower.Contains("proteine") || nameLower.Contains("verdure") ||
            nameLower.Contains("tramezzini") || nameLower.Contains("tost") ||
            nameLower.Contains("tostone") || nameLower.Contains("pizzette") ||
            nameLower.Contains("piadine") || nameLower.Contains("bresaola") ||
            nameLower.Contains("finger") || nameLower.Contains("cubano"))
            return "Cucina";

        return "Altro";
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
