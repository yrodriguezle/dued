using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.Services.Fornitori;

/// <summary>
/// Risolve il nome di una categoria di spesa (stringa, come consumata dal frontend)
/// verso il suo <see cref="CategoriaSpesa.Id"/> persistito su spese e pagamenti.
/// Centralizza il mapping nome→FK introdotto con la configurabilità delle categorie,
/// evitando di duplicare la logica negli orchestrator.
/// </summary>
public class CategoriaSpesaService
{
    public const string NomeDefault = "Altro";

    private readonly AppDbContext _db;

    public CategoriaSpesaService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Restituisce l'id della categoria con il nome indicato. Se il nome è null/vuoto
    /// viene usato il default <see cref="NomeDefault"/>. Se la categoria non esiste viene
    /// creata al volo (ottimista): il seed si occupa comunque delle voci canoniche.
    /// </summary>
    public async Task<int> RisolviIdAsync(string? nome)
    {
        string nomeEffettivo = string.IsNullOrWhiteSpace(nome) ? NomeDefault : nome.Trim();

        CategoriaSpesa? categoria = await _db.CategorieSpesa
            .FirstOrDefaultAsync(c => c.Nome == nomeEffettivo);

        if (categoria == null)
        {
            int ordine = await _db.CategorieSpesa.CountAsync();
            categoria = new CategoriaSpesa
            {
                Nome = nomeEffettivo,
                Attiva = true,
                Ordine = ordine
            };
            _db.CategorieSpesa.Add(categoria);
            await _db.SaveChangesAsync();
        }

        return categoria.Id;
    }
}
