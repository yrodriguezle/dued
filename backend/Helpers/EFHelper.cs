using System.Reflection;
using System.Linq.Expressions;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using duedgusto.DataAccess;

namespace duedgusto.Helpers;

public static class EFHelper
{
    public static object GetPrimaryKeys<T>(T entity, DbContext dataContext) where T : class
    {
        EntityEntry entry = dataContext.Entry(entity);
        IKey primaryKey = entry.Metadata.FindPrimaryKey() ?? throw new Exception($"The entity no have a primary key");
        IEnumerable<object?> primaryKeyValuesList = primaryKey.Properties
            .ToDictionary(x => x.Name, x => x.PropertyInfo?.GetValue(entity))
            .ToList()
            .Select((x) => x.Value);
        return primaryKeyValuesList.ToArray();
    }

    public static async Task<T> GetExistingEntity<T>(T entity, DbContext dataContext) where T : class
    {
        object[] primaryKeyValues = (object[])GetPrimaryKeys(entity, dataContext);
        return await dataContext.FindAsync<T>(primaryKeyValues) ?? throw new Exception("No entity found");
    }
    public static bool ArePrimaryKeysEqual(object[] keys1, object[] keys2)
    {
        return keys1.Length == keys2.Length && keys1.SequenceEqual(keys2);
    }
    public static async Task<T> SetEntityProperties<T>(T entity, T? foundEntity, DbContext dataContext, string[]? ignores = null, string[]? force = null) where T : class
    {
        string[] ignoreProps = ignores ?? [];
        string[] forceProps = force ?? [];

        EntityEntry<T> newOrUpdatedEntity;
        if (foundEntity is T)
        {
            EntityEntry entityEntry = dataContext.Entry(foundEntity);
            Dictionary<string, object?> props = [];
            PropertyInfo[] entityProps = entity.GetType().GetProperties();
            foreach (PropertyInfo propInfo in entityProps)
            {
                object? propValue = propInfo.PropertyType == typeof(DateTime?)
                    ? UtilityHelper.N2D(propInfo.GetValue(entity))
                    : propInfo.GetValue(entity);
                if (
                    (
                        forceProps.Contains(propInfo.Name)
                        || (propValue != null || propInfo.PropertyType == typeof(DateTime?))
                    )
                    && !ignoreProps.Contains(propInfo.Name)
                )
                {
                    props.Add(propInfo.Name, propValue);
                }
            }
            entityEntry.CurrentValues.SetValues(props);
            newOrUpdatedEntity = dataContext.Set<T>().Update(foundEntity);
        }
        else
        {
            newOrUpdatedEntity = await dataContext.Set<T>().AddAsync(entity);
        }
        return newOrUpdatedEntity.Entity;
    }
    public static async Task<T> AddOrUpdate<T>(T entity, T? foundEntity, DbContext dataContext, string[]? ignores = null) where T : class
    {
        return await SetEntityProperties(entity, foundEntity, dataContext, ignores);
    }
    public static async Task<T> AddOrUpdate<T>(T entity, DbContext dataContext, string[]? ignores = null, string[]? force = null) where T : class
    {
        T? foundEntity = await GetExistingEntity(entity, dataContext);
        return await SetEntityProperties(entity, foundEntity, dataContext, ignores, force);
    }
    public static async Task<T?> Delete<T>(T entity, DbContext dataContext) where T : class
    {
        var primaryKeys = GetPrimaryKeys(entity, dataContext);
        if (primaryKeys == null) return null;

        object[] primaryKeyValues = (object[])primaryKeys;
        T? foundEntity = await dataContext.FindAsync<T>(primaryKeyValues);
        if (foundEntity != null)
        {
            dataContext.Set<T>().Remove(foundEntity);
            await dataContext.SaveChangesAsync();
            return foundEntity;
        }
        return null;
    }
    public static async Task<bool> UpdateBulk<T>(this IEnumerable<T> incomingRows, Expression<Func<T, bool>> whereExpression, DbContext dataContext) where T : class
    {
        IEnumerable<T> dbRows = await dataContext.Set<T>().Where(whereExpression).AsNoTracking().ToListAsync();

        object?[] incomingIds = incomingRows.Select((entity) => GetPrimaryKeys(entity, dataContext)).ToArray();
        object?[] existingIds = dbRows.Select((entity) => GetPrimaryKeys(entity, dataContext)).ToArray();

        IEnumerable<T> toDelete = dbRows.Where((entity) => !incomingIds.Contains(GetPrimaryKeys(entity, dataContext)));
        IEnumerable<T> toAdd = incomingRows.Where((entity) => !existingIds.Contains(GetPrimaryKeys(entity, dataContext)));
        IEnumerable<T> toUpdate = incomingRows.Where((entity) => existingIds.Contains(GetPrimaryKeys(entity, dataContext)));

        dataContext.Set<T>().RemoveRange(toDelete);
        dataContext.Set<T>().AddRange(toAdd);
        dataContext.Set<T>().UpdateRange(toUpdate);
        return true;
    }
    public static TRepository? GetRepository<T, TRepository>(IRepositoryWrapper repositoryWrapper)
        where T : class, IEntity
        where TRepository : class, IRepositoryBase<T>
    {
        PropertyInfo propertyInfo = repositoryWrapper.GetType()
            .GetProperties()
            .FirstOrDefault(p => typeof(TRepository).IsAssignableFrom(p.PropertyType))
            ?? throw new InvalidOperationException($"Repository of type {typeof(TRepository).Name} not found.");

        return propertyInfo.GetValue(repositoryWrapper) as TRepository;
    }
    public static IRepositoryWrapper? GetRepositoryWrapper(IResolveFieldContext context)
    {
        using IServiceScope? scope = context.RequestServices?.CreateScope();
        IServiceProvider? services = scope?.ServiceProvider;
        return services?.GetRequiredService<IRepositoryWrapper>();
    }
    public static bool ArePropertiesIndexedOrPrimaryKey(IEntityType entityType, string properties)
    {
        string[] propertyNames = properties.Split(',');

        // Check if the properties represent the primary key
        IKey? primaryKey = entityType.FindPrimaryKey();
        if (primaryKey != null)
        {
            var primaryKeyProperties = primaryKey.Properties.Select(p => p.Name).ToArray();
            if (propertyNames.Length == primaryKeyProperties.Length && !propertyNames.Except(primaryKeyProperties).Any())
            {
                return true; // Properties represent the primary key
            }
        }

        // Check if the properties are indexed
        foreach (string propertyName in propertyNames)
        {
            IProperty? property = entityType.FindProperty(propertyName);
            if (property == null)
            {
                return false; // Property not found in the entity
            }

            IEnumerable<IIndex> indexes = entityType.GetIndexes();
            bool isIndexed = indexes.Any(index => index.Properties.Any(p => p.Name == propertyName));
            if (!isIndexed)
            {
                return false; // Property is not indexed
            }
        }

        return true; // All properties are indexed
    }
}
