using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.GraphQL.GestioneCassa.Types;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Orchestrator del CRUD delle categorie di spesa configurabili.
/// Il nome è l'identità logica: non si possono eliminare categorie ancora usate da spese o
/// pagamenti (la FK è Restrict), né rinominare una categoria sovrascrivendo un nome esistente.
/// </summary>
public class CategoriaSpesaOrchestrator
{
    private readonly AppDbContext _db;

    public CategoriaSpesaOrchestrator(AppDbContext db)
    {
        _db = db;
    }

    public async Task<CategoriaSpesa> MutateAsync(CategoriaSpesaInput input)
    {
        string nome = input.Nome?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(nome))
            throw new ExecutionError("Il nome della categoria è obbligatorio.");

        CategoriaSpesa? categoria;
        if (input.CategoriaId is int id)
        {
            categoria = await _db.CategorieSpesa.FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ExecutionError($"Categoria con id {id} non trovata.");
        }
        else
        {
            categoria = await _db.CategorieSpesa.FirstOrDefaultAsync(c => c.Nome == nome);
            if (categoria == null)
            {
                categoria = new CategoriaSpesa
                {
                    Nome = nome,
                    Attiva = true,
                    Ordine = await _db.CategorieSpesa.CountAsync()
                };
                _db.CategorieSpesa.Add(categoria);
                await _db.SaveChangesAsync();
                return categoria;
            }
        }

        // Unicità del nome (escludendo se stessa)
        bool nomeUsato = await _db.CategorieSpesa
            .AnyAsync(c => c.Nome == nome && c.Id != categoria.Id);
        if (nomeUsato)
            throw new ExecutionError($"Esiste già una categoria con nome '{nome}'.");

        categoria.Nome = nome;
        if (input.Attiva is bool attiva) categoria.Attiva = attiva;
        if (input.Ordine is int ordine) categoria.Ordine = ordine;
        categoria.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return categoria;
    }

    public async Task<bool> EliminaAsync(int categoriaId)
    {
        CategoriaSpesa? categoria = await _db.CategorieSpesa
            .FirstOrDefaultAsync(c => c.Id == categoriaId)
            ?? throw new ExecutionError($"Categoria con id {categoriaId} non trovata.");

        bool inUso = await _db.SpeseCassa.AnyAsync(s => s.CategoriaId == categoriaId)
            || await _db.PagamentiFornitori.AnyAsync(p => p.CategoriaId == categoriaId);

        if (inUso)
            throw new ExecutionError($"La categoria '{categoria.Nome}' è usata da spese o pagamenti e non può essere eliminata.");

        _db.CategorieSpesa.Remove(categoria);
        await _db.SaveChangesAsync();
        return true;
    }
}
