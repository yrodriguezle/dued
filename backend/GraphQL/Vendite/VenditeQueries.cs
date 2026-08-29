using GraphQL;
using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

namespace duedgusto.GraphQL.Vendite;

using System.Linq;
using duedgusto.GraphQL.Vendite.Types;
using duedgusto.Models;

public class VenditeQueries : ObjectGraphType
{
    public VenditeQueries()
    {
        Name = "VenditeQuery";

        // Ramo riservato: oltre al listino espone le vendite per registro di cassa.
        // Il listino pubblico del sito vetrina NON passa da qui, ma da /api/public/menu.
        this.Authorize();

        // Get all products (paginated)
        Field<ListGraphType<ProdottoType>>("prodotti")
            .Argument<StringGraphType>("ricerca", "Termine di ricerca")
            .Argument<StringGraphType>("categoria", "Categoria prodotto")
            .Argument<IntGraphType>("limite", "Limite risultati", configure: arg => arg.DefaultValue = 100)
            .Argument<IntGraphType>("scostamento", "Offset paginazione", configure: arg => arg.DefaultValue = 0)
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var search = context.GetArgument<string?>("ricerca");
                var category = context.GetArgument<string?>("categoria");
                var limit = context.GetArgument<int>("limite");
                var offset = context.GetArgument<int>("scostamento");

                IQueryable<Prodotto> query = dbContext.Prodotti.Where(p => p.Attivo);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchTerm = search.ToLower();
                    query = query.Where(p =>
                        p.Codice.ToLower().Contains(searchTerm) ||
                        p.Nome.ToLower().Contains(searchTerm)
                    );
                }

                if (!string.IsNullOrWhiteSpace(category))
                {
                    query = query.Where(p => p.Categoria == category);
                }

                return await query
                    .OrderBy(p => p.Codice)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            });

        // Get single product
        Field<ProdottoType>("prodotto")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID prodotto")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var id = context.GetArgument<int>("id");
                return await dbContext.Prodotti
                    .FirstOrDefaultAsync(p => p.ProdottoId == id);
            });

        // Get sales by register
        Field<ListGraphType<VenditaType>>("vendite")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId", "ID registro cassa")
            .Argument<DateTimeGraphType>("dataDa", "Data inizio")
            .Argument<DateTimeGraphType>("dataA", "Data fine")
            .Argument<IntGraphType>("limite", "Limite risultati", configure: arg => arg.DefaultValue = 100)
            .Argument<IntGraphType>("scostamento", "Offset paginazione", configure: arg => arg.DefaultValue = 0)
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var registerId = context.GetArgument<int>("registroCassaId");
                DateTime? dateFrom = context.GetArgument<DateTime?>("dataDa");
                DateTime? dateTo = context.GetArgument<DateTime?>("dataA");
                var limit = context.GetArgument<int>("limite");
                var offset = context.GetArgument<int>("scostamento");

                IQueryable<Vendita> query = dbContext.Vendite
                      .Where(s => s.RegistroCassaId == registerId)
                      .AsQueryable();

                if (dateFrom.HasValue)
                {
                    query = query.Where(s => s.DataOra >= dateFrom.Value);
                }

                if (dateTo.HasValue)
                {
                    query = query.Where(s => s.DataOra <= dateTo.Value.AddDays(1));
                }

                return await query
                    .OrderByDescending(s => s.DataOra)
                    .Skip(offset)
                    .Take(limit)
                    .ToListAsync();
            });

        // Get single sale
        Field<VenditaType>("vendita")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID vendita")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var id = context.GetArgument<int>("id");
                return await dbContext.Vendite
                    .FirstOrDefaultAsync(s => s.VenditaId == id);
            });

        // ── Ordini ──────────────────────────────────────────────────────────────────────────

        Field<OrdineType>("ordine")
            .Description("Un ordine per id, in qualunque stato.")
            .Argument<NonNullGraphType<IntGraphType>>("id", "ID ordine")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var id = context.GetArgument<int>("id");
                return await dbContext.Ordini.FirstOrDefaultAsync(o => o.OrdineId == id);
            });

        Field<NonNullGraphType<ListGraphType<NonNullGraphType<OrdineType>>>>("ordiniDelRegistro")
            .Description("Gli ordini di un registro, filtrabili per stato. Omettere `stati` "
                + "restituisce tutto lo storico del giorno, annullati e stornati compresi.")
            .Argument<NonNullGraphType<IntGraphType>>("registroCassaId", "ID registro cassa")
            .Argument<ListGraphType<NonNullGraphType<StringGraphType>>>("stati", "Stati ammessi")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var registroCassaId = context.GetArgument<int>("registroCassaId");
                var stati = context.GetArgument<List<string>?>("stati");

                IQueryable<Ordine> query = dbContext.Ordini
                    .Where(o => o.RegistroCassaId == registroCassaId);

                if (stati is { Count: > 0 })
                {
                    // Uno stato scritto male darebbe una lista vuota, che si legge come «non ci
                    // sono ordini» invece che «hai sbagliato il filtro»: il caso peggiore, perché
                    // il vuoto è una risposta legittima e nessuno la mette in dubbio.
                    foreach (string stato in stati.Where(s => !StatiOrdine.IsAmmesso(s)))
                    {
                        throw new ExecutionError(
                            $"Stato ordine non ammesso: {stato}. Valori ammessi: " +
                            string.Join(", ", StatiOrdine.Ammessi) + ".");
                    }

                    query = query.Where(o => stati.Contains(o.Stato));
                }

                return await query
                    .OrderBy(o => o.Numero)
                    .ThenBy(o => o.SuffissoSplit)
                    .ToListAsync();
            });

        // 🔴 L'ARGOMENTO È OPZIONALE, E NON È UNA COMODITÀ.
        //    Omesso, questa query restituisce gli ordini aperti di TUTTI i registri, e deve farlo.
        //    Un ordine aperto alle 23:50 appartiene al registro di IERI — decisione della issue:
        //    finché la cassa non si chiude, tutto resta nel giorno di apertura — quindi un filtro
        //    su «oggi» lo farebbe sparire dall'elenco alle 00:05. Siccome la chiusura di cassa si
        //    blocca finché ci sono ordini aperti, il registro di ieri resterebbe bloccato per
        //    sempre da un ordine invisibile, con un blocco che non mostra la propria causa.
        //    Chi consuma questa query mostra `dataRegistro` su ogni riga: è così che l'operatore
        //    vede che quell'ordine è di ieri invece di cercarlo fra quelli di oggi.
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<OrdineType>>>>("ordiniAperti")
            .Description("Gli ordini in stato APERTO. Senza registroCassaId li restituisce di "
                + "TUTTI i registri: un ordine aperto ieri e non ancora incassato deve restare "
                + "visibile, o bloccherebbe la chiusura di ieri senza farsi trovare.")
            .Argument<IntGraphType>("registroCassaId", "Limita a un solo registro. Opzionale.")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int? registroCassaId = context.GetArgument<int?>("registroCassaId");

                IQueryable<Ordine> query = dbContext.Ordini
                    .Where(o => o.Stato == StatiOrdine.Aperto);

                if (registroCassaId.HasValue)
                {
                    query = query.Where(o => o.RegistroCassaId == registroCassaId.Value);
                }

                // Per istante di apertura: il più vecchio in cima, che è anche il più urgente da
                // chiudere. Ordinare per data del registro darebbe lo stesso esito passando però
                // da una join, e l'ordine dentro la giornata coincide con il progressivo.
                return await query.OrderBy(o => o.ApertoIl).ToListAsync();
            });

        // Get product categories
        Field<ListGraphType<StringGraphType>>("categorieProdotto")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.Prodotti
                    .Where(p => p.Attivo && p.Categoria != null)
                    .Select(p => p.Categoria)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToListAsync();
            });
    }
}
