import { TypedDocumentNode } from "@apollo/client";
import { OperationDefinitionNode, FieldNode } from "graphql";

function getQueryName<T>(query: TypedDocumentNode<RelayData<T>, RelayVariables>): string {
  const operationDefinition = query.definitions.find(({ kind }) => kind === "OperationDefinition") as OperationDefinitionNode | undefined;

  if (!operationDefinition) {
    throw new Error("No operation definition found in the provided query document.");
  }

  const connectionField = operationDefinition.selectionSet.selections.find((selection) => selection.kind === "Field" && selection.name.value === "connection") as FieldNode | undefined;

  if (!connectionField) {
    throw new Error("No 'connection' field found in the query document.");
  }

  if (!connectionField.selectionSet || connectionField.selectionSet.selections.length === 0) {
    throw new Error("No fields found under 'connection' in the query document.");
  }

  const queryField = connectionField.selectionSet.selections[0];
  if (queryField.kind !== "Field" || !queryField.name?.value) {
    throw new Error("No valid query name found under 'connection' field.");
  }

  return queryField.name.value;
}

export default getQueryName;
