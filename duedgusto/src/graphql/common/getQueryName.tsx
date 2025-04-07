import { TypedDocumentNode } from "@apollo/client";
import { OperationDefinitionNode } from "graphql";

function getQueryName<T>(query: TypedDocumentNode<RelayData<T>, RelayVariables>): string {
  const operationDefinition = query.definitions.find(({ kind }) => kind === "OperationDefinition") as OperationDefinitionNode | undefined;

  if (!operationDefinition) {
    throw new Error("No operation definition found in the provided query document.");
  }

  const selection = operationDefinition?.selectionSet?.selections[1];
  if (!selection || !("name" in selection) || !selection.name?.value) {
    throw new Error("No valid query name found in the operation definition.");
  }

  return selection.name.value;
}

export default getQueryName;
