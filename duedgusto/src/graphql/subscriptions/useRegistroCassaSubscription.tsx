import { gql, useSubscription } from "@apollo/client";

const ON_REGISTRO_CASSA_UPDATED = gql`
  subscription OnRegistroCassaUpdated {
    onRegistroCassaUpdated {
      registroCassaId
      data
      stato
      totaleVendite
      totaleApertura
      totaleChiusura
      azione
    }
  }
`;

interface RegistroCassaUpdatedEvent {
  registroCassaId: number;
  data: string;
  stato: string;
  totaleVendite: number;
  totaleApertura: number;
  totaleChiusura: number;
  azione: string;
}

interface RegistroCassaUpdatedData {
  onRegistroCassaUpdated: RegistroCassaUpdatedEvent;
}

const useRegistroCassaSubscription = () => {
  return useSubscription<RegistroCassaUpdatedData>(ON_REGISTRO_CASSA_UPDATED);
};

export default useRegistroCassaSubscription;
