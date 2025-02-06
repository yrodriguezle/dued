import {
  useState,
  useEffect,
} from 'react';
import { useApolloClient, gql } from '@apollo/client';
import { USER_CHANGED_SUBSCRIPTION } from '../subscriptions';

const useSubscribeToUserChanged = () => {
  const [user, setUser] = useState();
  const client = useApolloClient();

  useEffect(() => {
    if (user) {
      setUser();
    }
  }, [user]);

  useEffect(() => {
    const observer = client.subscribe({
      query: gql`${USER_CHANGED_SUBSCRIPTION}`,
    });

    const subscription = observer.subscribe(({ data }) => {
      if (data?.userChanged) {
        const { userChanged } = data;
        setUser(userChanged);
      }
    });

    return () => subscription.unsubscribe();
  }, [client]);

  return { user };
};

export default useSubscribeToUserChanged;
