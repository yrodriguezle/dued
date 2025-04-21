using System.Reflection;

using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.ChangeTracking;

using duedgusto.DataAccess;

namespace duedgusto.Helpers;

public static class EntityFrameworkHelper
{
  public static object? GetPrimaryKeys<T>(T entity, AppDbContext dataContext) where T : class
  {
    EntityEntry entry = dataContext.Entry(entity);
    IKey? primaryKey = entry.Metadata.FindPrimaryKey();
    if (primaryKey == null)
    {
      return null;
    }

    IEnumerable<object?>? primaryKeyValuesList = primaryKey.Properties
      .ToDictionary(x => x.Name, x => x.PropertyInfo?.GetValue(entity))
      .ToList()
      .Select(x => x.Value);

    return primaryKeyValuesList?.ToArray();
  }

  public static async Task<T?> GetExistingEntity<T>(T entity, AppDbContext dataContext) where T : class
  {
    object[]? primaryKeyValues = (object[]?)GetPrimaryKeys(entity, dataContext);
    if (primaryKeyValues == null || primaryKeyValues.Length == 0)
    {
      return null;
    }
    return await dataContext.FindAsync<T>(primaryKeyValues);
  }

  public static async Task<T> SetEntityProperties<T>(T? entity, T? foundEntity, AppDbContext dataContext, string[]? ignores = null, string[]? force = null) where T : class
  {
    ArgumentNullException.ThrowIfNull(entity);

    string[] ignoreProps = ignores ?? [];
    string[] forceProps = force ?? [];

    EntityEntry<T> newOrUpdatedEntity;
    if (foundEntity is not null)
    {
      EntityEntry entityEntry = dataContext.Entry(foundEntity);
      PropertyInfo[] entityProps = entity.GetType().GetProperties();

      foreach (PropertyInfo propInfo in entityProps)
      {
        if (ignoreProps.Contains(propInfo.Name))
        {
          continue;
        }

        object? propValue = propInfo.GetValue(entity);
        if (forceProps.Contains(propInfo.Name) || !Equals(propInfo.GetValue(foundEntity), propValue))
        {
          entityEntry.Property(propInfo.Name).CurrentValue = propValue;
        }
      }

      newOrUpdatedEntity = dataContext.Set<T>().Update(foundEntity);
    }
    else
    {
      newOrUpdatedEntity = await dataContext.Set<T>().AddAsync(entity);
    }
    return newOrUpdatedEntity.Entity;
  }

  public static async Task<T> AddOrUpdate<T>(T? entity, T? foundEntity, AppDbContext dataContext, string[]? ignores = null) where T : class
  {
    ArgumentNullException.ThrowIfNull(entity);
    return await SetEntityProperties(entity, foundEntity, dataContext, ignores);
  }

  public static async Task<T?> AddOrUpdate<T>(T entity, AppDbContext dataContext, string[]? ignores = null, string[]? force = null) where T : class
  {
    ArgumentNullException.ThrowIfNull(entity);

    T? foundEntity = await GetExistingEntity(entity, dataContext);
    return await SetEntityProperties(entity, foundEntity, dataContext, ignores, force);
  }
}