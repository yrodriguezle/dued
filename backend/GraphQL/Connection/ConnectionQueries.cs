using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;
using GraphQL.Types.Relay;
using GraphQL.Types.Relay.DataObjects;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.Services.Jwt;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.ChiusureMensili.Types;
using duedgusto.GraphQL.Vendite.Types;
using duedgusto.GraphQL.Vetrina.Types;

namespace duedgusto.GraphQL.Connection;

public class ConnectionQueries : ObjectGraphType
{
    public ConnectionQueries()
    {
        // Ramo interamente riservato: espone anagrafiche, registri cassa, fornitori,
        // fatture e chiusure mensili. L'app lo interroga sempre dopo il login.
        this.Authorize();

        Field<ConnectionType<UtenteType>>("utenti")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<Utente> connection = await GraphQLService.GetConnectionAsync<Utente>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    utente =>
                    {
                        return utente.Id.ToString();
                    });
                return connection;
            });
        Field<ConnectionType<MenuType>>("menus")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<Menu> connection = await GraphQLService.GetConnectionAsync<Menu>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    menu =>
                    {
                        return menu.Id.ToString();
                    });
                return connection;
            });
        Field<ConnectionType<RuoloType>>("ruoli")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<Ruolo> connection = await GraphQLService.GetConnectionAsync<Ruolo>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    ruolo =>
                    {
                        return ruolo.Id.ToString();
                    });
                return connection;
            });

        Field<ConnectionType<RegistroCassaType>>("registriCassa")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                string? whereClause = context.GetArgument<string?>("where");
                string? orderByClause = context.GetArgument<string?>("orderBy");

                Connection<RegistroCassa> connection = await GraphQLService.GetConnectionAsync<RegistroCassa>(
                    context,
                    whereClause,
                    orderByClause,
                    registroCassa =>
                    {
                        return registroCassa.Id.ToString();
                    },
                    query =>
                    {
                        // Parse and apply WHERE clause safely using LINQ
                        if (!string.IsNullOrEmpty(whereClause))
                        {
                            query = ApplyRegistroCassaWhereClause(query, whereClause);
                        }

                        // Apply ORDER BY clause
                        if (!string.IsNullOrEmpty(orderByClause))
                        {
                            query = ApplyRegistroCassaOrderBy(query, orderByClause);
                        }
                        else
                        {
                            // Default ordering
                            query = query.OrderByDescending(r => r.Data);
                        }

                        return query;
                    });
                return connection;
            });

        Field<ConnectionType<FornitoreType>>("fornitori")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<Fornitore> connection = await GraphQLService.GetConnectionAsync<Fornitore>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    supplier =>
                    {
                        return supplier.FornitoreId.ToString();
                    });
                return connection;
            });

        Field<ConnectionType<FatturaAcquistoType>>("fattureAcquisto")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<FatturaAcquisto> connection = await GraphQLService.GetConnectionAsync<FatturaAcquisto>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    invoice =>
                    {
                        return invoice.FatturaId.ToString();
                    },
                    query =>
                    {
                        return query;
                    });
                return connection;
            });

        Field<ConnectionType<DocumentoTrasportoType>>("documentiTrasporto")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<DocumentoTrasporto> connection = await GraphQLService.GetConnectionAsync<DocumentoTrasporto>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    ddt =>
                    {
                        return ddt.DdtId.ToString();
                    },
                    query =>
                    {
                        return query;
                    });
                return connection;
            });

        Field<ConnectionType<PagamentoFornitoreType>>("pagamentiFornitori")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<PagamentoFornitore> connection = await GraphQLService.GetConnectionAsync<PagamentoFornitore>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    payment =>
                    {
                        return payment.PagamentoId.ToString();
                    });
                return connection;
            });

        Field<ConnectionType<ChiusuraMensileType>>("chiusureMensili")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<ChiusuraMensile> connection = await GraphQLService.GetConnectionAsync<ChiusuraMensile>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    closure =>
                    {
                        return closure.ChiusuraId.ToString();
                    },
                    query =>
                    {
                        return query
                            .Include(c => c.ChiusaDaUtente)
                            .Include(c => c.RegistriInclusi)
                                .ThenInclude(r => r.Registro);
                    });
                return connection;
            });

        // ── Vetrina ──────────────────────────────────────────────────────────────────

        Field<ConnectionType<ProdottoType>>("prodotti")
            .Description("Anagrafica prodotti con i campi vetrina. Restituisce ANCHE i non "
                + "attivi: è l'anagrafica, non il listino operativo — un prodotto stagionale "
                + "disattivato deve restare raggiungibile per curarne la scheda fuori stagione.")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<Prodotto> connection = await GraphQLService.GetConnectionAsync<Prodotto>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    prodotto =>
                    {
                        return prodotto.ProdottoId.ToString();
                    },
                    query =>
                    {
                        // 🔴 L'Include è l'unico punto in cui va messo: il lazy loading è
                        // disabilitato in tutto il progetto, quindi senza questa riga il
                        // thumbnail in griglia sarebbe sempre null — e sembrerebbe un dato
                        // mancante invece di una query incompleta.
                        return query
                            .Include(p => p.Immagine)
                            .OrderBy(p => p.Codice);
                    });
                return connection;
            });

        Field<ConnectionType<MediaAssetType>>("mediaAssets")
            .Description("Libreria media. Riservata agli amministratori anche in LETTURA.")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                // 🔴 Guard amministratore ANCHE in lettura, esattamente come nelle mutation.
                // Il design §D12 lo prevedeva sulle sole scritture; la spec `sicurezza` è più
                // stretta e vince: in questa fase non esiste alcun consumatore anonimo né non
                // amministrativo dei media, quindi la superficie va chiusa finché non ne
                // nasce uno. Aprirla dopo è una riga; accorgersi che era aperta è un incidente.
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                JwtHelper jwtHelper = GraphQLService.GetService<JwtHelper>(context);
                GraphQLUserContext userContext = context.UserContext as GraphQLUserContext
                    ?? throw new ExecutionError("Utente non autenticato");
                await GestioneCassaGuards.GuardUtenteAmministratore(
                    dbContext, jwtHelper.GetUserID(userContext.Principal!));

                Connection<MediaAsset> connection = await GraphQLService.GetConnectionAsync<MediaAsset>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    asset =>
                    {
                        return asset.MediaAssetId.ToString();
                    },
                    query =>
                    {
                        // CreatedAt come criterio di parità: senza, due asset con la stessa
                        // cartella e lo stesso ordinamento cambiano posto fra due letture
                        // identiche, e la paginazione a cursore salta o duplica righe.
                        return query
                            .OrderBy(m => m.Cartella)
                            .ThenBy(m => m.Ordinamento)
                            .ThenBy(m => m.CreatedAt);
                    });
                return connection;
            });
    }

    // Safe WHERE clause parser for RegistroCassa queries
    private static IQueryable<RegistroCassa> ApplyRegistroCassaWhereClause(IQueryable<RegistroCassa> query, string whereClause)
    {
        // Parse WHERE clause safely - only support specific patterns to prevent SQL injection
        // Supported patterns:
        // - data >= 'YYYY-MM-DD'
        // - data <= 'YYYY-MM-DD'
        // - data >= 'YYYY-MM-DD' AND data <= 'YYYY-MM-DD'

        var parts = whereClause.Split([" AND ", " and "], StringSplitOptions.RemoveEmptyEntries);

        foreach (var part in parts)
        {
            var trimmedPart = part.Trim();

            // Parse date comparisons (supporta sia "date" che "data")
            if (trimmedPart.StartsWith("data >=") || trimmedPart.StartsWith("date >="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data >= date);
                }
            }
            else if (trimmedPart.StartsWith("data <=") || trimmedPart.StartsWith("date <="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data <= date);
                }
            }
            else if (trimmedPart.StartsWith("data >") || trimmedPart.StartsWith("date >"))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data > date);
                }
            }
            else if (trimmedPart.StartsWith("data <") || trimmedPart.StartsWith("date <"))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data < date);
                }
            }
            else if (trimmedPart.StartsWith("data =") || trimmedPart.StartsWith("date ="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data == date);
                }
            }
        }

        return query;
    }

    private static string ExtractDateValue(string condition)
    {
        // Extract date value from conditions like "data >= '2024-01-01'"
        var startIndex = condition.IndexOf('\'');
        if (startIndex >= 0)
        {
            var endIndex = condition.IndexOf('\'', startIndex + 1);
            if (endIndex > startIndex)
            {
                return condition.Substring(startIndex + 1, endIndex - startIndex - 1);
            }
        }
        return string.Empty;
    }

    private static IQueryable<RegistroCassa> ApplyRegistroCassaOrderBy(IQueryable<RegistroCassa> query, string orderByClause)
    {
        // Safe ORDER BY parser - only support specific columns
        var orderBy = orderByClause.Trim().ToLower();

        if (orderBy.Contains("data desc") || orderBy.Contains("date desc"))
        {
            return query.OrderByDescending(r => r.Data);
        }
        else if (orderBy.Contains("data asc") || orderBy == "data" || orderBy.Contains("date asc") || orderBy == "date")
        {
            return query.OrderBy(r => r.Data);
        }
        else if (orderBy.Contains("id desc") || orderBy.Contains("registerid desc"))
        {
            return query.OrderByDescending(r => r.Id);
        }
        else if (orderBy.Contains("id asc") || orderBy == "id" || orderBy.Contains("registerid asc") || orderBy == "registerid")
        {
            return query.OrderBy(r => r.Id);
        }
        else
        {
            // Default: order by data descending
            return query.OrderByDescending(r => r.Data);
        }
    }
}
