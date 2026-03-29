using GraphQL;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.GraphQL.Fornitori.Types;

namespace duedgusto.GraphQL.Fornitori;

public class FornitoreOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;

    public FornitoreOrchestrator(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Fornitore> MutateAsync(FornitoreInput input)
    {
        Fornitore? fornitore;

        if (input.FornitoreId.HasValue)
        {
            fornitore = await _unitOfWork.Fornitori.GetByIdAsync(input.FornitoreId.Value)
                ?? throw new ExecutionError($"Fornitore con ID {input.FornitoreId} non trovato");
        }
        else
        {
            fornitore = new Fornitore();
            _unitOfWork.Fornitori.Add(fornitore);
        }

        fornitore.RagioneSociale = input.RagioneSociale;
        fornitore.RagioneSociale2 = input.RagioneSociale2;
        fornitore.PartitaIva = input.PartitaIva;
        fornitore.CodiceFiscale = input.CodiceFiscale;
        fornitore.Email = input.Email;
        fornitore.Telefono = input.Telefono;
        fornitore.Indirizzo = input.Indirizzo;
        fornitore.Citta = input.Citta;
        fornitore.Cap = input.Cap;
        fornitore.Provincia = input.Provincia;
        fornitore.Paese = input.Paese ?? "IT";
        fornitore.Note = input.Note;
        fornitore.Attivo = input.Attivo;
        fornitore.AliquotaIva = input.AliquotaIva;
        fornitore.AggiornatoIl = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync();

        return fornitore;
    }

    public async Task<bool> EliminaAsync(int fornitoreId)
    {
        var fornitore = await _unitOfWork.Fornitori.GetByIdAsync(fornitoreId)
            ?? throw new ExecutionError($"Fornitore con ID {fornitoreId} non trovato");

        // Soft delete
        fornitore.Attivo = false;
        fornitore.AggiornatoIl = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync();

        return true;
    }
}
