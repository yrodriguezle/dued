using GraphQL;
using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.GraphQL;
using duedgusto.GraphQL.Subscriptions.Types;

namespace duedgusto.GraphQL.Vendite;

using duedgusto.GraphQL.Vendite.Types;

public class VenditeMutations : ObjectGraphType
{
    public VenditeMutations()
    {
        Name = "VenditeMutation";

        // Create sale
        Field<VenditaType>("creaVendita")
            .Argument<NonNullGraphType<CreaVenditaInputType>>("input", "Dati vendita")
            .ResolveAsync(async context => await CreaVenditaAsync(context));

        // Update sale
        Field<VenditaType>("aggiornaVendita")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID vendita")
            .Argument<NonNullGraphType<AggiornaVenditaInputType>>("input", "Dati aggiornamento")
            .ResolveAsync(async context => await AggiornaVenditaAsync(context));

        // Delete sale
        Field<BooleanGraphType>("eliminaVendita")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID vendita")
            .ResolveAsync(async context => (object)await EliminaVenditaAsync(context));
    }

    private static async Task<Vendita> CreaVenditaAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var input = context.GetArgument<CreaVenditaInput>("input");

        // Verify product exists
        var product = await dbContext.Prodotti
            .FirstOrDefaultAsync(p => p.ProdottoId == input.ProdottoId);

        if (product == null)
        {
            throw new InvalidOperationException("Prodotto non trovato");
        }

        // Verify register exists
        var register = await dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == input.RegistroCassaId);

        if (register == null)
        {
            throw new InvalidOperationException("Cassa non trovata");
        }

        // Guard: verifica che il registro non appartenga a un mese chiuso
        var chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.DataAppartieneAMeseChiusoAsync(register.Data))
        {
            throw new InvalidOperationException(
                $"Impossibile creare vendite: il mese {register.Data:MM/yyyy} è chiuso.");
        }

        // Create sale
        var sale = new Vendita
        {
            RegistroCassaId = input.RegistroCassaId,
            ProdottoId = input.ProdottoId,
            Quantita = input.Quantita,
            PrezzoUnitario = product.Prezzo,
            PrezzoTotale = input.Quantita * product.Prezzo,
            Note = input.Note,
            DataOra = input.DataOra ?? DateTime.UtcNow,
            CreatoIl = DateTime.UtcNow,
            AggiornatoIl = DateTime.UtcNow
        };

        dbContext.Vendite.Add(sale);

        // Update register VenditeContanti total
        register.VenditeContanti += sale.PrezzoTotale;
        register.TotaleVendite = register.VenditeContanti + register.IncassiElettronici + register.IncassoContanteTracciato + register.IncassiFattura;
        register.AggiornatoIl = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        // Publish event for real-time subscriptions
        var eventBus = GraphQLService.GetService<IEventBus>(context);
        eventBus.Publish(new VenditaCreatedEvent
        {
            VenditaId = sale.VenditaId,
            RegistroCassaId = sale.RegistroCassaId,
            NomeProdotto = product.Nome,
            Quantita = (int)sale.Quantita,
            PrezzoTotale = sale.PrezzoTotale,
            DataOra = sale.DataOra
        });

        // Reload product for response
        sale.Prodotto = product;

        return sale;
    }

    private static async Task<Vendita> AggiornaVenditaAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var id = context.GetArgument<int>("id");
        var input = context.GetArgument<AggiornaVenditaInput>("input");

        var sale = await dbContext.Vendite
            .Include(s => s.Prodotto)
            .FirstOrDefaultAsync(s => s.VenditaId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        var chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile modificare vendite: il mese corrispondente è chiuso.");
        }

        // Verify product if changed
        if (input.ProdottoId.HasValue && input.ProdottoId.Value != sale.ProdottoId)
        {
            var product = await dbContext.Prodotti
                .FirstOrDefaultAsync(p => p.ProdottoId == input.ProdottoId.Value);

            if (product == null)
            {
                throw new InvalidOperationException("Prodotto non trovato");
            }

            sale.ProdottoId = product.ProdottoId;
            sale.PrezzoUnitario = product.Prezzo;
            sale.Prodotto = product;
        }

        if (input.Quantita.HasValue)
        {
            sale.Quantita = input.Quantita.Value;
        }

        if (input.Note != null)
        {
            sale.Note = input.Note;
        }

        sale.PrezzoTotale = sale.Quantita * sale.PrezzoUnitario;
        sale.AggiornatoIl = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return sale;
    }

    private static async Task<bool> EliminaVenditaAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var id = context.GetArgument<int>("id");

        var sale = await dbContext.Vendite
            .FirstOrDefaultAsync(s => s.VenditaId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        var chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile eliminare vendite: il mese corrispondente è chiuso.");
        }

        // Update register VenditeContanti total
        var register = await dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == sale.RegistroCassaId);

        if (register != null)
        {
            register.VenditeContanti -= sale.PrezzoTotale;
            register.TotaleVendite = register.VenditeContanti + register.IncassiElettronici + register.IncassoContanteTracciato + register.IncassiFattura;
            register.AggiornatoIl = DateTime.UtcNow;
        }

        dbContext.Vendite.Remove(sale);
        await dbContext.SaveChangesAsync();

        return true;
    }
}
