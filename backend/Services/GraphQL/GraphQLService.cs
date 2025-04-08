using System.Data;
using System.Data.Common;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

using GraphQL;
using GraphQL.DataLoader;
using GraphQL.Types.Relay.DataObjects;

using duedgusto.DataAccess;

namespace duedgusto.Services.GraphQL;

public class GraphQLService
{
    public static IServiceProvider GetServiceProvider(IResolveFieldContext<object?> context)
    {
        if (context.RequestServices == null)
        {
            throw new InvalidOperationException("RequestServices non è disponibile.");
        }
        IServiceScope scope = context.RequestServices.CreateScope();
        return scope.ServiceProvider;
    }

    public static T GetService<T>(IResolveFieldContext<object?> context) where T : class
    {
        IServiceProvider serviceProvider = GetServiceProvider(context);
        return serviceProvider.GetRequiredService<T>();
    }

    public static async Task<Connection<T>> GetConnectionAsync<T>(
        IResolveFieldContext<object?> context,
        string? whereClause,
        string? orderByClause,
        Func<T, string> cursorSelector
    ) where T : class
    {
        AppDbContext dbContext = GetService<AppDbContext>(context);
        IDataLoaderContextAccessor dataLoaderAccessor = GetService<IDataLoaderContextAccessor>(context);
        DataLoaderContext dataLoader = dataLoaderAccessor.Context;

        int pageSize = context.GetArgument<int?>("first") ?? 10;
        int offset = context.GetArgument<int?>("cursor") ?? 0;

        IEntityType entityType = dbContext.Model.FindEntityType(typeof(T)) ?? throw new InvalidOperationException($"EntityType non trovato per {typeof(T).Name}");
        string tableName = entityType.GetTableName() ?? typeof(T).Name;

        IProperty primaryKeyProperty = entityType.FindPrimaryKey()?.Properties[0] ?? throw new InvalidOperationException("Chiave primaria non trovata.");
        string primaryKey = primaryKeyProperty.Name;

        if (string.IsNullOrWhiteSpace(orderByClause))
        {
            orderByClause = primaryKey;
        }

        string conditionSql = !string.IsNullOrWhiteSpace(whereClause) ? " WHERE " + whereClause : "";

        string sqlQuery = $"SELECT * FROM {tableName}{conditionSql} ORDER BY {orderByClause} LIMIT {pageSize} OFFSET {offset}";
        string sqlCountQuery = $"SELECT COUNT(*) FROM {tableName}{conditionSql}";

        string loaderKey = $"Get{tableName}_{offset}_{pageSize}_{whereClause}_{orderByClause}";
        IDataLoader<List<T>> loader = dataLoader.GetOrAddLoader(loaderKey, () => dbContext.Set<T>().FromSqlRaw(sqlQuery).ToListAsync());
        List<T> items = await loader.LoadAsync().GetResultAsync();

        int totalCount = 0;
        using (DbConnection connection = dbContext.Database.GetDbConnection())
        {
            if (connection.State == ConnectionState.Closed)
            {
                await connection.OpenAsync();
            }
            using DbCommand command = connection.CreateCommand();
            command.CommandText = sqlCountQuery;
            totalCount = Convert.ToInt32(await command.ExecuteScalarAsync());
        }

        List<Edge<T>> edges = [.. items.Select(item => new Edge<T>
        {
            Node = item,
            Cursor = cursorSelector(item)
        })];

        string? startCursor = edges.FirstOrDefault()?.Cursor;
        string? endCursor = edges.LastOrDefault()?.Cursor;

        PageInfo pageInfo = new()
        {
            StartCursor = startCursor,
            EndCursor = endCursor,
            HasNextPage = (offset + pageSize) < totalCount,
            HasPreviousPage = offset > 0
        };

        Connection<T> connectionResult = new()
        {
            Edges = edges,
            PageInfo = pageInfo,
            TotalCount = totalCount
        };

        return connectionResult;
    }
}
