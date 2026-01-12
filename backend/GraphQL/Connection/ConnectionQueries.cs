using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;
using GraphQL.Types.Relay;
using GraphQL.Types.Relay.DataObjects;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.CashManagement.Types;

namespace duedgusto.GraphQL.Connection;

public class ConnectionQueries : ObjectGraphType
{
    public ConnectionQueries()
    {
        Field<ConnectionType<UserType>>("users")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<User> connection = await GraphQLService.GetConnectionAsync<User>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    user =>
                    {
                        return user.UserId.ToString();
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
        Field<ConnectionType<RoleType>>("roles")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<IntGraphType>("cursor", "Offset for pagination (deprecated, use after)")
            .Argument<StringGraphType>("after", "Cursor after which to return items")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("orderBy", "Order by clause")
            .ResolveAsync(async (context) =>
            {
                Connection<Role> connection = await GraphQLService.GetConnectionAsync<Role>(
                    context,
                    context.GetArgument<string>("where"),
                    context.GetArgument<string>("orderBy"),
                    role =>
                    {
                        return role.RoleId.ToString();
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
                            .Include(r => r.User)
                                .ThenInclude(u => u.Role)
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
