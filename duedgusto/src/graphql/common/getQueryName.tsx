import { TypedDocumentNode } from "@apollo/client";
import { OperationDefinitionNode, FieldNode } from "graphql";

function getQueryName<T>(query: TypedDocumentNode<RelayData<T>, RelayVariables>): string {
  const operationDefinition = query.definitions.find(({ kind }) => kind === "OperationDefinition") as OperationDefinitionNode | undefined;

  if (!operationDefinition) {
    throw new Error("No operation definition found in the provided query document.");
  }

  // First, try to find a 'connection' field (old pattern)
  const connectionField = operationDefinition.selectionSet.selections.find((selection) => selection.kind === "Field" && selection.name.value === "connection") as FieldNode | undefined;

  if (connectionField) {
    // Old pattern: query { connection { queryName { ... } } }
    if (!connectionField.selectionSet || connectionField.selectionSet.selections.length === 0) {
      throw new Error("No fields found under 'connection' in the query document.");
    }

    const queryField = connectionField.selectionSet.selections[0];
    if (queryField.kind !== "Field" || !queryField.name?.value) {
      throw new Error("No valid query name found under 'connection' field.");
    }

    return queryField.name.value;
  }

  // New pattern: query { queryName { ... } } (standard Relay connection at root)
  // Find the first field that has a 'totalCount' or 'pageInfo' child (indicates it's a connection)
  for (const selection of operationDefinition.selectionSet.selections) {
    if (selection.kind === "Field" && selection.selectionSet) {
      // Check if this field has connection-like structure (totalCount, pageInfo, edges/items)
      const hasConnectionFields = selection.selectionSet.selections.some((child) => {
        return child.kind === "Field" && (child.name.value === "totalCount" || child.name.value === "pageInfo" || child.name.value === "edges" || child.name.value === "items");
      });

      if (hasConnectionFields) {
        return selection.name.value;
      }
    }
  }

  throw new Error("No connection query found in the query document.");
}

export default getQueryName;
