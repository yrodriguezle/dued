import { gql, useSubscription } from "@apollo/client";

const ON_CHIUSURA_CASSA_COMPLETED = gql`
  subscription OnChiusuraCassaCompleted {
    onChiusuraCassaCompleted {
      registroCassaId
      data
      totaleChiusura
      differenza
    }
  }
`;

interface ChiusuraCassaCompletedEvent {
  registroCassaId: number;
  data: string;
  totaleChiusura: number;
  differenza: number;
}

interface ChiusuraCassaCompletedData {
  onChiusuraCassaCompleted: ChiusuraCassaCompletedEvent;
}

const useChiusuraCassaSubscription = () => {
  return useSubscription<ChiusuraCassaCompletedData>(ON_CHIUSURA_CASSA_COMPLETED);
};

export default useChiusuraCassaSubscription;
