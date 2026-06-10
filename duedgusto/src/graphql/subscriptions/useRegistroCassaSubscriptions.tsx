import { useEffect } from "react";
import useRegistroCassaSubscription from "./useRegistroCassaSubscription";
import useVenditaCreatedSubscription from "./useVenditaCreatedSubscription";
import useChiusuraCassaSubscription from "./useChiusuraCassaSubscription";

interface UseRegistroCassaSubscriptionsOptions {
  /** ID del registro cassa corrente (cashRegister?.id) */
  cashRegisterId: number | undefined;
  /** Refetch dei dati del registro corrente */
  refetch: () => void;
}

/**
 * Hook composito per le 3 subscription del registro cassa (lift letterale da
 * RegistroCassaDetails): quando un evento riguarda il registro corrente,
 * esegue il refetch. Eventi di altri registri vengono ignorati.
 */
function useRegistroCassaSubscriptions({ cashRegisterId, refetch }: UseRegistroCassaSubscriptionsOptions): void {
  // Subscription: aggiorna i dati quando il registro cassa corrente viene modificato
  const { data: registroUpdatedData } = useRegistroCassaSubscription();

  useEffect(() => {
    if (registroUpdatedData?.onRegistroCassaUpdated && cashRegisterId != null) {
      const event = registroUpdatedData.onRegistroCassaUpdated;
      if (event.registroCassaId === cashRegisterId) {
        refetch();
      }
    }
  }, [registroUpdatedData, cashRegisterId, refetch]);

  // Subscription: aggiorna i dati quando viene creata una nuova vendita per il registro corrente
  const { data: venditaCreatedData } = useVenditaCreatedSubscription();

  useEffect(() => {
    if (venditaCreatedData?.onVenditaCreated && cashRegisterId != null) {
      const event = venditaCreatedData.onVenditaCreated;
      if (event.registroCassaId === cashRegisterId) {
        refetch();
      }
    }
  }, [venditaCreatedData, cashRegisterId, refetch]);

  // Subscription: aggiorna lo stato quando la cassa viene chiusa
  const { data: chiusuraData } = useChiusuraCassaSubscription();

  useEffect(() => {
    if (chiusuraData?.onChiusuraCassaCompleted && cashRegisterId != null) {
      const event = chiusuraData.onChiusuraCassaCompleted;
      if (event.registroCassaId === cashRegisterId) {
        refetch();
      }
    }
  }, [chiusuraData, cashRegisterId, refetch]);
}

export default useRegistroCassaSubscriptions;
