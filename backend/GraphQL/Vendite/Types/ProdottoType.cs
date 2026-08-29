using GraphQL.Types;

using duedgusto.Common;
using duedgusto.GraphQL.Vetrina.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Vendite.Types;

public class ProdottoType : ObjectGraphType<Prodotto>
{
    public ProdottoType()
    {
        Field("prodottoId", x => x.ProdottoId);
        Field("codice", x => x.Codice);
        Field("nome", x => x.Nome);
        Field("descrizione", x => x.Descrizione, nullable: true);
        Field("prezzo", x => x.Prezzo);
        Field("categoria", x => x.Categoria, nullable: true);
        Field("unitaDiMisura", x => x.UnitaDiMisura);
        Field("attivo", x => x.Attivo);
        Field("aliquotaIva", x => x.AliquotaIva);
        Field("ordinamento", x => x.Ordinamento);
        Field("colore", x => x.Colore, nullable: true);
        Field("createdAt", x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.UpdatedAt, type: typeof(DateTimeGraphType));

        // ── Campi vetrina, in SOLA LETTURA ───────────────────────────────────────────
        // Si scrivono unicamente da mutateProdottoVetrina: esporli qui in lettura serve alla
        // griglia di amministrazione e al sito, non apre un secondo canale di scrittura.
        Field("visibileSulSito", x => x.VisibileSulSito);
        Field("nomeVetrina", x => x.NomeVetrina, nullable: true);
        Field("descrizioneVetrina", x => x.DescrizioneVetrina, nullable: true);
        Field("categoriaVetrina", x => x.CategoriaVetrina, nullable: true);
        Field("prezzoVetrina", x => x.PrezzoVetrina, nullable: true);
        Field("immagineId", x => x.ImmagineId, nullable: true);
        Field("ordinamentoVetrina", x => x.OrdinamentoVetrina);
        Field("allergeni", x => x.Allergeni, nullable: true);
        Field("novita", x => x.Novita);
        Field("consigliato", x => x.Consigliato);
        // ⚠️ La forma con il tipo esplicito e il resolve, e non `Field(nome, x => x.Campo,
        //    nullable, type)`: quell'overload è obsoleto nella 8 e sparisce nella 9, e
        //    l'analizzatore GQL004 lo segnala come avviso di compilazione.
        Field<DateOnlyGraphType>("inLavagnaDal")
            .Description("Il giorno in cui il prodotto sta sulla lavagna all'ingresso. Il sito "
                + "la mostra solo se il valore è oggi: una data scade da sola, un interruttore "
                + "no.")
            .Resolve(context => context.Source.InLavagnaDal);

        Field<MediaAssetType>("immagine")
            .Description("Immagine di vetrina. Richiede Include(p => p.Immagine) a monte: senza, "
                + "il lazy loading è disabilitato e questo campo risponde sempre null.")
            .Resolve(context => context.Source.Immagine);

        // ── Due campi DERIVATI, mai persistiti ───────────────────────────────────────
        // Sono calcolati in lettura e mai scritti a database: persisterli significherebbe
        // doverli ricalcolare a ogni scrittura dei due campi da cui dipendono — e il giorno
        // in cui uno dei due percorsi lo dimentica, il sito pubblica ciò che la cassa
        // considera ritirato.
        // Le due regole NON vivono qui: vivono in Common/RegoleVetrina.cs, che è l'unico
        // posto in cui sono scritte. Questi resolver le chiamano — un resolver non è
        // richiamabile da un controller, quindi tenerle qui costringerebbe l'API pubblica
        // a riscriverle.

        Field<NonNullGraphType<BooleanGraphType>>("pubblicatoSulSito")
            .Description("Se il prodotto è davvero visibile al pubblico: attivo in cassa E "
                + "marcato per il sito. È la regola unica su cui filtrerà l'API pubblica — "
                + "chiunque filtri diversamente sta inventando un secondo criterio.")
            .Resolve(context => RegoleVetrina.EPubblicato(context.Source));

        Field<NonNullGraphType<DecimalGraphType>>("prezzoEffettivoVetrina")
            .Description("Prezzo da mostrare sul sito: quello di vetrina se valorizzato, "
                + "altrimenti quello di listino. Il fallback è DINAMICO, valutato a ogni "
                + "lettura, così un aggiornamento di listino si riflette sul sito senza "
                + "alcuna scrittura di vetrina. 0 è un prezzo valido (omaggio) e NON ricade "
                + "sul listino: solo null è assenza.")
            .Resolve(context => RegoleVetrina.PrezzoEffettivo(context.Source));
    }
}
