using GraphQL;
using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.GraphQL;
using duedgusto.GraphQL.GestioneCassa;
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

        // Create/update product (unico punto di amministrazione prodotti, UI fuori scope)
        Field<ProdottoType>("mutateProdotto")
            .Authorize()
            .Argument<NonNullGraphType<ProdottoInputType>>("prodotto", "Dati prodotto")
            .ResolveAsync(async context => await MutateProdottoAsync(context));
    }

    /// <summary>
    /// Snapshot IVA di riga: scorporo da PrezzoTotale con l'aliquota snapshot vigente
    /// (percentuale → frazione SOLO via IvaCalculator.AliquotaDaPercentuale).
    /// Garantisce Imponibile + ImportoIva == PrezzoTotale al centesimo.
    /// </summary>
    public static void RicalcolaImportiSnapshot(Vendita sale)
    {
        RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
            sale.PrezzoTotale, IvaCalculator.AliquotaDaPercentuale(sale.AliquotaIva));
        sale.Imponibile = scorporo.Imponibile;
        sale.ImportoIva = scorporo.Iva;
    }

    /// <summary>
    /// Costruisce una nuova vendita con snapshot IVA al momento della creazione:
    /// aliquota copiata dal prodotto, importi scorporati da PrezzoTotale.
    /// </summary>
    public static Vendita CostruisciVendita(Prodotto product, CreaVenditaInput input)
    {
        var sale = new Vendita
        {
            RegistroCassaId = input.RegistroCassaId,
            ProdottoId = input.ProdottoId,
            Quantita = input.Quantita,
            PrezzoUnitario = product.Prezzo,
            PrezzoTotale = input.Quantita * product.Prezzo,
            AliquotaIva = product.AliquotaIva,
            Note = input.Note,
            DataOra = input.DataOra ?? DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        RicalcolaImportiSnapshot(sale);
        return sale;
    }

    /// <summary>
    /// Applica l'aggiornamento alla vendita (senza SaveChanges): al cambio prodotto
    /// riprende prezzo E aliquota correnti del nuovo prodotto; senza cambio prodotto
    /// lo snapshot aliquota resta immutato (storico). Gli importi snapshot vengono
    /// ricalcolati SOLO se PrezzoTotale o aliquota snapshot cambiano (update solo-note
    /// → snapshot intatto), sempre con l'aliquota snapshot vigente.
    /// </summary>
    public static async Task ApplicaAggiornamentoVenditaAsync(
        AppDbContext dbContext, Vendita sale, AggiornaVenditaInput input)
    {
        decimal prezzoTotalePrecedente = sale.PrezzoTotale;
        decimal aliquotaPrecedente = sale.AliquotaIva;

        // Verify product if changed
        if (input.ProdottoId.HasValue && input.ProdottoId.Value != sale.ProdottoId)
        {
            Prodotto? product = await dbContext.Prodotti
                      .FirstOrDefaultAsync(p => p.ProdottoId == input.ProdottoId.Value);

            if (product == null)
            {
                throw new InvalidOperationException("Prodotto non trovato");
            }

            sale.ProdottoId = product.ProdottoId;
            sale.PrezzoUnitario = product.Prezzo;
            sale.AliquotaIva = product.AliquotaIva;
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

        if (sale.PrezzoTotale != prezzoTotalePrecedente || sale.AliquotaIva != aliquotaPrecedente)
        {
            RicalcolaImportiSnapshot(sale);
        }

        sale.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Riallinea i totali e il breakdown IVA del registro dalla somma delle Vendite
    /// persistite (punto di calcolo unico, condiviso con l'orchestrator del registro).
    /// Pattern due-save: la vendita è già persistita, qui si salva il registro.
    /// </summary>
    private static async Task ApplicaBreakdownRegistroAsync(
        AppDbContext dbContext, RegistroCassa register, ILogger logger)
    {
        BusinessSettings settings = await dbContext.BusinessSettings.FirstAsync();
        await BreakdownIvaApplier.ApplicaAsync(dbContext, register, settings.VatRate, logger);
        register.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
    }

    private static async Task<Vendita> CreaVenditaAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        CreaVenditaInput input = context.GetArgument<CreaVenditaInput>("input");

        // Verify product exists
        Prodotto? product = await dbContext.Prodotti
                .FirstOrDefaultAsync(p => p.ProdottoId == input.ProdottoId);

        if (product == null)
        {
            throw new InvalidOperationException("Prodotto non trovato");
        }

        // Verify register exists
        RegistroCassa? register = await dbContext.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == input.RegistroCassaId);

        if (register == null)
        {
            throw new InvalidOperationException("Cassa non trovata");
        }

        // Guard: verifica che il registro non appartenga a un mese chiuso
        ChiusuraMensileService chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.DataAppartieneAMeseChiusoAsync(register.Data))
        {
            throw new InvalidOperationException(
                $"Impossibile creare vendite: il mese {register.Data:MM/yyyy} è chiuso.");
        }

        // Create sale con snapshot IVA al momento della vendita
        Vendita sale = CostruisciVendita(product, input);

        dbContext.Vendite.Add(sale);
        await dbContext.SaveChangesAsync();

        // Totali e breakdown IVA del registro dalla somma delle vendite persistite
        ILogger logger = GraphQLService.GetService<ILogger<VenditeMutations>>(context);
        await ApplicaBreakdownRegistroAsync(dbContext, register, logger);

        // Publish event for real-time subscriptions
        IEventBus eventBus = GraphQLService.GetService<IEventBus>(context);
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
        AggiornaVenditaInput input = context.GetArgument<AggiornaVenditaInput>("input");

        Vendita? sale = await dbContext.Vendite
                .FirstOrDefaultAsync(s => s.VenditaId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        ChiusuraMensileService chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile modificare vendite: il mese corrispondente è chiuso.");
        }

        await ApplicaAggiornamentoVenditaAsync(dbContext, sale, input);
        await dbContext.SaveChangesAsync();

        // Riallineamento totali/breakdown registro (sana anche il bug latente:
        // il cambio quantità non aggiornava mai VenditeContanti/TotaleVendite)
        RegistroCassa register = await dbContext.RegistriCassa
                .FirstAsync(r => r.Id == sale.RegistroCassaId);
        ILogger logger = GraphQLService.GetService<ILogger<VenditeMutations>>(context);
        await ApplicaBreakdownRegistroAsync(dbContext, register, logger);

        return sale;
    }

    private static async Task<bool> EliminaVenditaAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        var id = context.GetArgument<int>("id");

        Vendita? sale = await dbContext.Vendite
                .FirstOrDefaultAsync(s => s.VenditaId == id);

        if (sale == null)
        {
            throw new InvalidOperationException("Vendita non trovata");
        }

        // Guard: verifica che la vendita non appartenga a un mese chiuso
        ChiusuraMensileService chiusuraService = GraphQLService.GetService<ChiusuraMensileService>(context);
        if (await chiusuraService.RegistroAppartieneAMeseChiusoAsync(sale.RegistroCassaId))
        {
            throw new InvalidOperationException(
                "Impossibile eliminare vendite: il mese corrispondente è chiuso.");
        }

        RegistroCassa? register = await dbContext.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == sale.RegistroCassaId);

        dbContext.Vendite.Remove(sale);
        await dbContext.SaveChangesAsync();

        // Totali e breakdown IVA ricalcolati dalla somma delle vendite rimaste
        if (register != null)
        {
            ILogger logger = GraphQLService.GetService<ILogger<VenditeMutations>>(context);
            await ApplicaBreakdownRegistroAsync(dbContext, register, logger);
        }

        return true;
    }

    private static async Task<Prodotto> MutateProdottoAsync(IResolveFieldContext<object?> context)
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        ProdottoInput input = context.GetArgument<ProdottoInput>("prodotto");

        return await UpsertProdottoAsync(dbContext, input);
    }

    /// <summary>
    /// Upsert prodotto per ProdottoId (null/0 = creazione) con validazioni esplicite
    /// PRIMA del save: aliquota nel set ammesso (costante centralizzata IvaCalculator),
    /// codice non vuoto e univoco (errore leggibile invece della violazione dell'indice
    /// unique), prezzo non negativo. NON chiama SaveChanges su errore di validazione.
    /// </summary>
    public static async Task<Prodotto> UpsertProdottoAsync(AppDbContext dbContext, ProdottoInput input)
    {
        if (!IvaCalculator.IsAliquotaAmmessa(input.AliquotaIva))
        {
            throw new ExecutionError(
                $"Aliquota IVA non ammessa: {input.AliquotaIva}. Valori ammessi: " +
                string.Join(", ", IvaCalculator.AliquoteAmmessePercentuali) + ".");
        }

        string codice = input.Codice.Trim();
        if (codice.Length == 0)
        {
            throw new ExecutionError("Il codice prodotto è obbligatorio.");
        }

        if (input.Prezzo < 0)
        {
            throw new ExecutionError("Il prezzo del prodotto non può essere negativo.");
        }

        Prodotto? prodotto = null;
        if (input.ProdottoId is > 0)
        {
            prodotto = await dbContext.Prodotti
                    .FirstOrDefaultAsync(p => p.ProdottoId == input.ProdottoId.Value);

            if (prodotto == null)
            {
                throw new InvalidOperationException("Prodotto non trovato");
            }
        }

        // Codice univoco (escludendo il prodotto stesso in aggiornamento)
        bool codiceDuplicato = await dbContext.Prodotti.AnyAsync(p =>
            p.Codice == codice && (prodotto == null || p.ProdottoId != prodotto.ProdottoId));
        if (codiceDuplicato)
        {
            throw new ExecutionError($"Esiste già un prodotto con codice '{codice}'.");
        }

        if (prodotto == null)
        {
            prodotto = new Prodotto { CreatedAt = DateTime.UtcNow };
            dbContext.Prodotti.Add(prodotto);
        }

        prodotto.Codice = codice;
        prodotto.Nome = input.Nome;
        prodotto.Descrizione = input.Descrizione;
        prodotto.Prezzo = input.Prezzo;
        prodotto.Categoria = input.Categoria;
        prodotto.UnitaDiMisura = input.UnitaDiMisura ?? prodotto.UnitaDiMisura;
        prodotto.Attivo = input.Attivo;
        prodotto.AliquotaIva = input.AliquotaIva;
        prodotto.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return prodotto;
    }
}
