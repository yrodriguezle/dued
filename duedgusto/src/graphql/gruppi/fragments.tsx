/**
 * Il gruppo come lo vedono sia il banco sia la pagina di gestione.
 *
 * ⚠️ `prezzoMinimo` e `prezzoUniforme` sono **derivati dal server a ogni lettura**, non colonne:
 *    servono al tastone per dire «da 2,50 €», oppure «2,50 €» quando tutte le varianti costano
 *    uguale. Un prezzo salvato sul gruppo invecchierebbe in silenzio.
 */
export const gruppoProdottiFragment = `fragment GruppoProdottiFragment on GruppoProdotti {
  gruppoProdottiId
  codice
  nome
  colore
  ordinamento
  attivo
  prezzoMinimo
  prezzoUniforme
  membri {
    prodottoId
    ordinamento
    prodotto {
      prodottoId
      codice
      nome
      prezzo
      categoria
      aliquotaIva
      ordinamento
      colore
    }
  }
}`;
