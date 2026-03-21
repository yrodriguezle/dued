import { gql, useSubscription } from "@apollo/client";

const ON_VENDITA_CREATED = gql`
  subscription OnVenditaCreated {
    onVenditaCreated {
      venditaId
      registroCassaId
      nomeProdotto
      quantita
      prezzoTotale
      dataOra
    }
  }
`;

interface VenditaCreatedEvent {
  venditaId: number;
  registroCassaId: number;
  nomeProdotto: string;
  quantita: number;
  prezzoTotale: number;
  dataOra: string;
}

interface VenditaCreatedData {
  onVenditaCreated: VenditaCreatedEvent;
}

const useVenditaCreatedSubscription = () => {
  return useSubscription<VenditaCreatedData>(ON_VENDITA_CREATED);
};

export default useVenditaCreatedSubscription;
