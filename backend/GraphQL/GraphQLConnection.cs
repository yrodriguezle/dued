// Copyright (©) 2020 Flavio Zanellato
// All rights reserved.
// 
// Author: Flavio Zanellato

using System;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.RegularExpressions;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;

using GraphQL.DataLoader;
using GraphQL.Builders;
using GraphQL.Types.Relay.DataObjects;

using AMICO4forWEB.Services;
using AMICO4forWEB.Helpers;
using AMICO4forWEB.Models;
using DueD.Repositories;
using DueD.Helpers;
using DueD.GraphQL;
using DueD.Services;

namespace AMICO4forWEB.DataAccess.GraphQL
{
    public static class GraphQLConnection
    {
        const int DEFAULT_PAGE_SIZE = 10;

        const string SELECT_KEYWORD = "SELECT DISTINCT";
        const string WHERE_KEYWORD = "WHERE";
        const string LEFT_JOIN_KEYWORD = "LEFT JOIN";
        const string ORDER_BY_KEYWORD = "ORDER BY";
        const string OFFSET_KEYWORD = "OFFSET";
        static readonly string[] intTypes = { "Int16", "Int32", "Byte" };

        private static IKey GetIKey(EntityEntry entry)
        {
            return entry.Metadata.FindPrimaryKey();
        }

        private static string GetEntityName(EntityEntry entry)
        {
            return entry.Metadata.GetTableName();
        }

        private static int GetPageSize<TParent>(ResolveConnectionContext<TParent> context) where TParent : class
        {
            if (context.Last != null)
            {
                return context.Last.Value;
            }
            if (context.First != null)
            {
                return context.First.Value;
            }
            return (context.PageSize ?? DEFAULT_PAGE_SIZE);
        }

        private static string GetDirection<TParent>(ResolveConnectionContext<TParent> context) where TParent : class
        {
            if (!string.IsNullOrWhiteSpace(context.After) || context.First != null)
            {
                return "ASC";
            }
            if (!string.IsNullOrWhiteSpace(context.Before) || context.Last != null)
            {
                return "DESC";
            }
            return "ASC";
        }

        private static string GetDefaultSelectStatement(string tableName)
        {
            return $"{SELECT_KEYWORD} [{tableName}].* FROM [{tableName}]";
        }

        private static string DBCasting(Dictionary<string, string> orderByTypes, string fromCursor, string beforeOrAfter)
        {
            string cursor = string.Empty;
            List<string> values = fromCursor.Split("`").ToList();

            if (values.Count() == orderByTypes.Count())
            {
                Dictionary<string, KeyValuePair<string, string>> scalarValues = new Dictionary<string, KeyValuePair<string, string>>();
                int count = 0;
                orderByTypes.ToList().ForEach((KeyValuePair<string, string> keyValuePair) => 
                {
                    string value = intTypes.Contains(keyValuePair.Value)
                            ? values[count].PadLeft(12, Convert.ToChar("0"))
                            : values[count];
                    KeyValuePair<string, string> typeAndValuePair = new KeyValuePair<string, string>(keyValuePair.Value, value);
                    scalarValues.Add(keyValuePair.Key, typeAndValuePair);
                    count += 1;
                });
                
                List<string> scalarCastingTypes = new List<string>();
                List<string> scalarValuesArray = new List<string>();

                scalarValues.ToList().ForEach((keyPair) =>
                {
                    KeyValuePair<string, string> typeValue = keyPair.Value;
                    string fieldName = keyPair.Key;
                    string type = typeValue.Key;
                    string value = typeValue.Value;
                    switch (type)
                    {
                        case "Int16":
                        case "Int32":
                        case "Byte":
                            scalarCastingTypes.Add($"RIGHT('000000000000' + CAST({fieldName} AS NVARCHAR), 12)");
                            scalarValuesArray.Add(value);
                            break;
                        case "DateTime":
                        case "Date":
                            scalarCastingTypes.Add($"CONVERT(NVARCHAR, {fieldName}, 120)"); // 120 yyyy-mm-dd hh:mi:ss ODBC canonical (24 hour clock)
                            DateTime.TryParse(value.Trim(), out DateTime dateTimeValue);
                            string dateTimeValueString = Convert.ToDateTime(dateTimeValue).ToString(UtilityHelper.DATETIME_FORMAT_DB).Replace(".", ":");
                            scalarValuesArray.Add(dateTimeValueString);
                            break;
                        default:
                            scalarCastingTypes.Add($"CAST({fieldName} AS NVARCHAR)");
                            scalarValuesArray.Add(value);
                            break;
                    }
                });

                if (scalarCastingTypes.Count() > 0 && scalarCastingTypes.Count() == scalarValuesArray.Count())
                {
                    cursor = $"{string.Join(" + '`' + ", scalarCastingTypes)} {beforeOrAfter} {UtilityHelper.BuildDBString(string.Join("`", scalarValuesArray), DBVarType.String)}";
                }
            }
            return cursor;
        }

        public static string GetCursor(string fromCursor, Dictionary<string, string> orderByTypes, string direction)
        {
            string beforeOrAfter = direction == "ASC" ? ">" : "<";
            return DBCasting(orderByTypes, fromCursor, beforeOrAfter);
        }

        public static string GetCursor<TParent>(ResolveConnectionContext<TParent> context, Dictionary<string, string> orderByTypes, string direction) where TParent : class
        {
            if (!string.IsNullOrWhiteSpace(context.After))
            {
                return GetCursor(context.After, orderByTypes, direction);
            }
            if (!string.IsNullOrWhiteSpace(context.Before))
            {
                return GetCursor(context.Before, orderByTypes, direction);
            }
            return string.Empty;
        }

        private static IEnumerable<T> SetCursorKeys<T>(this DbContext dbContext, IEnumerable<T> entities, Dictionary<string, string> orderByKeys)
        {
            foreach (IEntity entity in entities)
            {
                string[] values = orderByKeys.ToList().Select((KeyValuePair<string, string> keyValuePair) =>
                {
                    if (intTypes.Contains(keyValuePair.Value))
                    {
                        return Convert.ToString(dbContext.Entry(entity).CurrentValues[keyValuePair.Key]).PadLeft(12, Convert.ToChar("0"));
                    }
                    return Convert.ToString(dbContext.Entry(entity).CurrentValues[keyValuePair.Key]);
                }).ToArray();
                entity.Keys = string.Join("`", values);
            }
            return entities;
        }

        public static Connection<TSource> SetConnectionObject<TSource, TParent>(
            IEnumerable<TSource> resultset,
            ResolveConnectionContext<TParent> context,
            int totalCount,
            int pageSize,
            string direction
        )
            where TSource : class
            where TParent : class
        {
            List<Edge<TSource>> edges = resultset.Select((item, i) => new Edge<TSource>
            {
                Node = item,
                Cursor = ((IEntity)item).Keys
            }).ToList();

            bool hasPreviousPage = false;
            bool hasNextPage = false;
            if (context.First != null)
            {
                hasPreviousPage = false;
                if (totalCount > pageSize)
                {
                    hasNextPage = true;
                }
                if (resultset.Count() == 0 || edges.Count() < Convert.ToInt32(context.First))
                {
                    hasNextPage = false;
                }
            }
            if (context.Last != null)
            {
                hasNextPage = false;
                if (totalCount > pageSize)
                {
                    hasPreviousPage = true;
                }
                if (resultset.Count() == 0 || edges.Count() < Convert.ToInt32(context.Last))
                {
                    hasPreviousPage = false;
                }
            }
            return new Connection<TSource>
            {
                Edges = edges,
                TotalCount = totalCount,
                PageInfo = new PageInfo
                {
                    StartCursor = direction == "ASC" ? edges.FirstOrDefault()?.Cursor : edges.LastOrDefault()?.Cursor,
                    EndCursor = direction == "ASC" ? edges.LastOrDefault()?.Cursor : edges.FirstOrDefault()?.Cursor,
                    HasPreviousPage = hasPreviousPage,
                    HasNextPage = hasNextPage,
                }
            };
        }

        public static async Task<Connection<TSource>> Connection<TSource, TParent>(
            this IEnumerable<TSource> enumerable,
            ResolveConnectionContext<TParent> context,
            IDataLoaderContextAccessor accessor,
            IRepository repository,
            IConfiguration configuration,
            ConnectionArguments sqlModel,
            DbService dbService,
            ILogger<DueDQueries> logger)
            where TSource : class
            where TParent : class
        {
            try
            {
                // Get primary keys
                TSource entity = Activator.CreateInstance<TSource>();
                EntityEntry entry = repository.DbContext.Entry(entity);
                string entityName = $"{GetEntityName(entry)}";
                IKey primaryKey = GetIKey(entry);
                Dictionary<string, object?> primaryKeys = primaryKey.Properties.ToDictionary((prop) => prop.Name, (prop) => prop.PropertyInfo?.GetValue(entity));

                string orderByClause = !string.IsNullOrWhiteSpace(sqlModel.OrderBy) 
                    ? sqlModel.OrderBy
                    : string.Join(",", primaryKeys.Keys.Select(key => $"{entityName}.{key}").ToArray());

                // User cannot set direction when using pagination query, it must be set by directive
                orderByClause = Regex.Replace(orderByClause, @"\s*ASC(\s+|$)|\s*DESC(\s+|$)|\s+", string.Empty, RegexOptions.IgnoreCase);

                if (context.After == null && context.Before == null)
                {
                    bool orderByIsAnUniqueCombination = await dbService.AreUniqueFieldsInTable(entityName, orderByClause, repository != null);
                    if (!orderByIsAnUniqueCombination)
                    {
                        throw new Exception($"ORDER BY keys: `{orderByClause}` are not unique for table: {entityName}!");
                    }
                }

                // Set order types
                Dictionary<string, string> orderByTypes = new();
                string[] orderByFields = orderByClause.Split(",").Select((field) => field.Replace($"{entityName}.", string.Empty)).ToArray();
                PropertyInfo[] entityProps = entity.GetType().GetProperties();
                orderByFields.ToList().ForEach((field) =>
                {
                    PropertyInfo propInfo = entityProps.FirstOrDefault((pInfo) => pInfo.Name == field);
                    if (propInfo is not null)
                    {
                        string fieldName = propInfo.Name;
                        string fieldType = propInfo.PropertyType.Name.Contains("Nullable")
                             ? Nullable.GetUnderlyingType(propInfo.PropertyType)?.Name
                             : propInfo.PropertyType.Name;
                        orderByTypes.Add($"{entityName}.{fieldName}", fieldType);
                    }
                });

                // Set order-by-keys or regular-keys in order to build keys field to give connection
                // Key = fieldName, Value = typeOf
                Dictionary<string, string> orderByKeys = orderByTypes.ToDictionary(
                    (keyPair) => keyPair.Key.Replace($"{entityName}.", string.Empty),
                    (keyPair) => keyPair.Value);

                // Set pagination
                int pageSize = GetPageSize(context);
                string pagination = $"{OFFSET_KEYWORD} 0 ROWS FETCH NEXT {pageSize} ROWS ONLY";

                // Set direction
                string direction = GetDirection(context);

                // Set cursor
                string cursor = GetCursor(context, orderByTypes, direction);

                // Set select
                string selectClause = sqlModel.Select ?? GetDefaultSelectStatement(entityName);

                // Set join
                string joinClause = sqlModel.Join ?? string.Empty;

                // Set where for total rows count
                List<string> whereTotalStatements = new List<string>();
                if (!string.IsNullOrWhiteSpace(sqlModel.Where))
                {
                    whereTotalStatements.Add(sqlModel.Where);
                }

                string whereTotalCountClause = whereTotalStatements.Count() > 0
                    ? $"{WHERE_KEYWORD} {string.Join(" AND ", whereTotalStatements)}"
                    : string.Empty;

                // Set where
                List<string> whereStatements = new();
                if (!string.IsNullOrWhiteSpace(sqlModel.Where))
                {
                    whereStatements.Add(sqlModel.Where);
                }
                if (!string.IsNullOrWhiteSpace(cursor))
                {
                    whereStatements.Add(cursor);
                }

                string whereClause = whereStatements.Count() > 0
                    ? $"{WHERE_KEYWORD} {string.Join(" AND ", whereStatements)}"
                    : string.Empty;

                // Set order by
                orderByClause = string.Join(",", orderByClause.Split(",").Select((field) => $"{field} {direction}"));

                // Compose SQL query
                string sqlQuery = $"{selectClause} {joinClause} {whereClause} {sqlModel.ExceptSubQuery} {ORDER_BY_KEYWORD} {orderByClause} {pagination}";
                sqlQuery = Regex.Replace(sqlQuery, @"\s{2,}", " ", RegexOptions.IgnoreCase);

                // Compose SQL total rows query
                string sqlTotalRowsQuery = $"{GetDefaultSelectStatement(entityName)} {joinClause} {whereTotalCountClause} {sqlModel.ExceptSubQuery}";
                sqlTotalRowsQuery = Regex.Replace(sqlTotalRowsQuery, @"\s{2,}", " ", RegexOptions.IgnoreCase);
                sqlTotalRowsQuery = sqlTotalRowsQuery.Replace("{{", "{").Replace("}}", "}");
                sqlTotalRowsQuery = $"({sqlTotalRowsQuery}) AS T";

                // Initialize entities collection
                IEnumerable<TSource> resultset;

                // Get raw data for totalCount
                int totalCount = 0;
                GenericService<TSource> genericRepository = new(configuration, repository.DbContext);


                IDataLoader<IEnumerable<TSource>> loader = accessor.Context.GetOrAddLoader("GetBySql", () => genericRepository.Entity.GetBySqlAsync(sqlQuery));
                resultset = (await loader.LoadAsync().GetResultAsync()).OfType<TSource>();
                resultset = repository.DbContext.SetCursorKeys(resultset, orderByKeys);
                totalCount = await dbService.GetQueryRecordsCount(sqlTotalRowsQuery);

                return SetConnectionObject(resultset, context, totalCount, pageSize, direction);
            }
            catch (Exception exception)
            {
                logger.LogError(exception.Message);
                throw;
            }
        }
    }
}
