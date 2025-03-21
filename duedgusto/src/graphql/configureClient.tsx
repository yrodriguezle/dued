import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;

function configureClient() {
  if (apolloClient) {
    return apolloClient;
  }
  apolloClient = new ApolloClient({
    uri: (window as Global).GRAPHQL_ENDPOINT,
    cache: new InMemoryCache(),
  });
  return apolloClient;
}

export default configureClient;
