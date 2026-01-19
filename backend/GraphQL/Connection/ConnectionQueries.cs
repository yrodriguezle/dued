using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;
using GraphQL.Types.Relay;
using GraphQL.Types.Relay.DataObjects;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.CashManagement.Types;
using duedgusto.GraphQL.Suppliers.Types;
using duedgusto.GraphQL.MonthlyClosures.Types;
using duedgusto.GraphQL.ChiusureMensili.Types;

namespace duedgusto.GraphQL.Connection;

public class ConnectionQueries : ObjectGraphType
{
    public ConnectionQueries()
    {
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
                        return menu.MenuId.ToString();
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

        Field<ConnectionType<CashRegisterType>>("cashRegisters")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                string? whereClause = context.GetArgument<string?>("where");
                string? orderByClause = context.GetArgument<string?>("orderBy");

                Connection<CashRegister> connection = await GraphQLService.GetConnectionAsync<CashRegister>(
                    context,
                    whereClause,
                    orderByClause,
                    cashRegister =>
                    {
                        return cashRegister.RegisterId.ToString();
                    },
                    query =>
                    {
                        // Include related entities
                        query = query
                            .Include(r => r.Utente)
                                .ThenInclude(u => u.Ruolo)
                            .Include(r => r.CashCounts)
                                .ThenInclude(c => c.Denomination)
                            .Include(r => r.CashIncomes)
                            .Include(r => r.CashExpenses);

                        // Parse and apply WHERE clause safely using LINQ
                        if (!string.IsNullOrEmpty(whereClause))
                        {
                            query = ApplyCashRegisterWhereClause(query, whereClause);
                        }

                        // Apply ORDER BY clause
                        if (!string.IsNullOrEmpty(orderByClause))
                        {
                            query = ApplyCashRegisterOrderBy(query, orderByClause);
                        }
                        else
                        {
                            // Default ordering
                            query = query.OrderByDescending(r => r.Date);
                        }

                        return query;
                    });
                return connection;
            });

        Field<ConnectionType<SupplierType>>("suppliers")
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

        Field<ConnectionType<PurchaseInvoiceType>>("purchaseInvoices")
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
                        return query
                            .Include(i => i.Fornitore)
                            .Include(i => i.DocumentiTrasporto)
                            .Include(i => i.Pagamenti);
                    });
                return connection;
            });

        Field<ConnectionType<DeliveryNoteType>>("deliveryNotes")
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
                        return query
                            .Include(d => d.Fornitore)
                            .Include(d => d.Fattura)
                            .Include(d => d.Pagamenti);
                    });
                return connection;
            });

        Field<ConnectionType<SupplierPaymentType>>("supplierPayments")
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
                    },
                    query =>
                    {
                        return query
                            .Include(p => p.Fattura)
                                .ThenInclude(f => f.Fornitore)
                            .Include(p => p.Ddt)
                                .ThenInclude(d => d.Fornitore)
                            .Include(p => p.SpeseMensili);
                    });
                return connection;
            });

        Field<ConnectionType<ChiusuraMensileType>>("monthlyClosures")
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
                            .Include(c => c.Spese)
                                .ThenInclude(s => s.Pagamento);
                    });
                return connection;
            });

        Field<ConnectionType<MonthlyExpenseType>>("monthlyExpenses")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<SpesaMensile> connection = await GraphQLService.GetConnectionAsync<SpesaMensile>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    expense =>
                    {
                        return expense.SpesaId.ToString();
                    },
                    query =>
                    {
                        return query
                            .Include(e => e.Chiusura)
                            .Include(e => e.Pagamento)
                                .ThenInclude(p => p.Fattura)
                                    .ThenInclude(f => f.Fornitore)
                            .Include(e => e.Pagamento)
                                .ThenInclude(p => p.Ddt)
                                    .ThenInclude(d => d.Fornitore);
                    });
                return connection;
            });
    }

    // Safe WHERE clause parser for CashRegister queries
    private static IQueryable<CashRegister> ApplyCashRegisterWhereClause(IQueryable<CashRegister> query, string whereClause)
    {
        // Parse WHERE clause safely - only support specific patterns to prevent SQL injection
        // Supported patterns:
        // - date >= 'YYYY-MM-DD'
        // - date <= 'YYYY-MM-DD'
        // - date >= 'YYYY-MM-DD' AND date <= 'YYYY-MM-DD'

        var parts = whereClause.Split(new[] { " AND ", " and " }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var part in parts)
        {
            var trimmedPart = part.Trim();

            // Parse date comparisons
            if (trimmedPart.StartsWith("date >="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Date >= date);
                }
            }
            else if (trimmedPart.StartsWith("date <="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Date <= date);
                }
            }
            else if (trimmedPart.StartsWith("date >"))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Date > date);
                }
            }
            else if (trimmedPart.StartsWith("date <"))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Date < date);
                }
            }
            else if (trimmedPart.StartsWith("date ="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Date == date);
                }
            }
        }

        return query;
    }

    private static string ExtractDateValue(string condition)
    {
        // Extract date value from conditions like "date >= '2024-01-01'"
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

    private static IQueryable<CashRegister> ApplyCashRegisterOrderBy(IQueryable<CashRegister> query, string orderByClause)
    {
        // Safe ORDER BY parser - only support specific columns
        var orderBy = orderByClause.Trim().ToLower();

        if (orderBy.Contains("date desc"))
        {
            return query.OrderByDescending(r => r.Date);
        }
        else if (orderBy.Contains("date asc") || orderBy == "date")
        {
            return query.OrderBy(r => r.Date);
        }
        else if (orderBy.Contains("registerid desc"))
        {
            return query.OrderByDescending(r => r.RegisterId);
        }
        else if (orderBy.Contains("registerid asc") || orderBy == "registerid")
        {
            return query.OrderBy(r => r.RegisterId);
        }
        else
        {
            // Default: order by date descending
            return query.OrderByDescending(r => r.Date);
        }
    }
}
