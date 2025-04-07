import { TypedDocumentNode } from "@apollo/client";
import { OperationDefinitionNode, FieldNode } from "graphql";

function getQueryName<T>(query: TypedDocumentNode<RelayData<T>, RelayVariables>): string {
  const operationDefinition = query.definitions.find(({ kind }) => kind === "OperationDefinition") as OperationDefinitionNode | undefined;

  if (!operationDefinition) {
    throw new Error("No operation definition found in the provided query document.");
  }

  const managementField = operationDefinition.selectionSet.selections.find((selection) => selection.kind === "Field" && selection.name.value === "management") as FieldNode | undefined;

  if (!managementField) {
    throw new Error("No 'management' field found in the query document.");
  }

  if (!managementField.selectionSet || managementField.selectionSet.selections.length === 0) {
    throw new Error("No fields found under 'management' in the query document.");
  }

  const queryField = managementField.selectionSet.selections[0];
  if (queryField.kind !== "Field" || !queryField.name?.value) {
    throw new Error("No valid query name found under 'management' field.");
  }

  return queryField.name.value;
}

export default getQueryName;
