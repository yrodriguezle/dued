import { useMemo } from 'react';

export const sqlSanitizeValue = (newValue = '') => newValue.toString().replace(/'/g, "''");
const regExpWhere = /\$where/g;

const useQueryParams = ({
  fields,
  fragment = '',
  queryName,
  fieldNamePrimary,
  value,
  lookupSelect,
  lookupTableName,
  lookupJoin,
  lookupWhere,
  lookupOrderBy,
  additionalWhere,
  direction = 'first',
  pageItems,
  param,
}) => {
  const params = useMemo(
    () => fields
      .map(({ fieldName }) => fieldName)
      .join(' '),
    [fields],
  );

  const query = useMemo(() => (`
    ${fragment}
    query GetDataBy ($select: String, $join: String, $where: String, $${direction}: Int, $orderBy: String, $cursor: String, $param: String, $typedValue: String) {
      ${queryName} (select: $select, join: $join, where: $where, ${direction}: $${direction}, orderBy: $orderBy, ${direction === 'first' ? 'after' : 'before'}: $cursor, param: $param, typedValue: $typedValue) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        items {
          ${params}
        }
      }
    }
  `), [direction, fragment, params, queryName]);

  const variables = useMemo(
    () => {
      const values = value ? value.trim().split(' ') : [];
      const sanitizeValues = values.map((val) => `'%${sqlSanitizeValue(val)}%'`);
      const valuesWhere = sanitizeValues.length ? `[${lookupTableName}].${fieldNamePrimary} LIKE ${sanitizeValues.join(` AND [${lookupTableName}].${fieldNamePrimary} LIKE `)}` : undefined;

      const regularWhere = regExpWhere.test(lookupWhere)
        ? lookupWhere.replace(regExpWhere, valuesWhere)
        : [lookupWhere, valuesWhere].filter((required) => required).join(' AND ');

      const where = [regularWhere, additionalWhere]
        .filter((required) => required)
        .map((statement, index, array) => (array.length > 1 ? `(${statement})` : statement))
        .join(' OR ');

      return {
        [direction]: Array.isArray(pageItems) ? pageItems[0] : pageItems,
        select: lookupSelect,
        join: lookupJoin,
        where,
        orderBy: lookupOrderBy,
        param,
        typedValue: value,
      };
    },
    [additionalWhere, direction, fieldNamePrimary, lookupJoin, lookupOrderBy, lookupSelect, lookupTableName, lookupWhere, pageItems, param, value],
  );

  return {
    query,
    variables,
  };
};

export default useQueryParams;
