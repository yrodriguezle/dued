namespace duedgusto.Models;

public class Prodotto
{
    public int ProdottoId { get; set; }
    public string Codice { get; set; } = string.Empty; // Codice prodotto (da Listino)
    public string Nome { get; set; } = string.Empty; // Descrizione prodotto
    public string? Descrizione { get; set; } // Descrizione estesa opzionale
    public decimal Prezzo { get; set; } // Prezzo unitario
    public string? Categoria { get; set; } // Categoria prodotto
    public string? UnitaDiMisura { get; set; } = "pz"; // Unità di misura (pz, kg, l, etc.)
    public bool Attivo { get; set; } = true; // Prodotto attivo/disattivato

    /// <summary>
    /// Aliquota IVA del prodotto in PERCENTUALE (es. 22.00 = 22%), come Fornitore.AliquotaIva.
    /// La conversione a frazione per i calcoli avviene SOLO via IvaCalculator.AliquotaDaPercentuale.
    /// </summary>
    public decimal AliquotaIva { get; set; } = 22m;

    /// <summary>
    /// L'ordine con cui la tessera si presenta nella griglia del punto vendita, dentro la sua
    /// categoria. Zero significa «mai ordinato» e non «primo»: il pareggio su
    /// <see cref="Codice"/> manda in coda chi non è stato disposto a mano, che è il
    /// comportamento di prima del campo.
    ///
    /// <para>⚠️ Da non confondere con <see cref="OrdinamentoVetrina"/>, che dispone i piatti
    /// sul sito pubblico. Sono due assi indipendenti e devono restarlo: l'ordine con cui i
    /// piatti si presentano al cliente e quello con cui la mano li trova al banco non hanno
    /// motivo di coincidere.</para>
    /// </summary>
    public int Ordinamento { get; set; }

    /// <summary>
    /// Il colore <b>editoriale</b> della tessera: quello della bevanda, non quello della
    /// categoria. Liscio bianco, Aperol arancione, Campari rosso, Cynar viola.
    ///
    /// <para>🔴 <b>Quando è valorizzato vince sul colore generato.</b> Il sistema in produzione
    /// (<c>coloriProdotto.tsx</c>) deriva la tinta dalla categoria e distingue le voci solo per
    /// luminosità: va benissimo per centoquaranta tessere, e non basta dentro un gruppo di
    /// varianti, dove il colore È il modo in cui si riconosce lo spritz giusto senza leggere.
    /// I due meccanismi convivono: il generato per la griglia, l'esplicito dove serve.</para>
    ///
    /// <para>⚠️ Appartiene alla cassa e sta quindi in <c>ProdottoInput</c>, a differenza dei
    /// campi di vetrina qui sotto, che non devono mai comparirvi.</para>
    /// </summary>
    public string? Colore { get; set; }

    /// <summary>
    /// I gruppi a cui questo prodotto appartiene. ⚠️ Può essere in più d'uno, ed è voluto:
    /// comparirà sotto entrambi i tastoni.
    /// </summary>
    public ICollection<ProdottoGruppo> Gruppi { get; set; } = new List<ProdottoGruppo>();

    // ── Campi vetrina (sito pubblico) ────────────────────────────────────────
    // 🔴 NESSUNO di questi campi deve mai comparire in ProdottoInput: UpsertProdottoAsync
    //    assegna ogni campo esplicitamente, quindi il primo upsert della cassa che non li
    //    invia li azzererebbe in massa su tutti i prodotti. Hanno un solo scrittore,
    //    mutateProdottoVetrina, ed è ciò che rende sicura l'assegnazione totale lì.
    //    Vedi design.md §D8; il confine è pinnato da un test strutturale.

    /// <summary>
    /// Intenzione editoriale ("voglio questo prodotto sul sito"), da non confondere con
    /// <see cref="Attivo"/>, che è lo stato di vendita in cassa. Sono due domini distinti e
    /// nessuno dei due scrive sull'altro: disattivare un prodotto stagionale per due settimane
    /// non deve far perdere nome, descrizione e immagine della sua scheda di vetrina.
    /// Default false: un prodotto non finisce online per il solo fatto di esistere — il
    /// listino contiene codici tecnici (SCONTRINO, STORNO) che non devono uscire mai.
    /// </summary>
    public bool VisibileSulSito { get; set; }

    public string? NomeVetrina { get; set; }
    public string? DescrizioneVetrina { get; set; }

    /// <summary>
    /// Categoria per il sito, separata da <see cref="Categoria"/>: quella è contabile e serve
    /// ai raggruppamenti di cassa, questa è come il piatto viene presentato al cliente.
    /// </summary>
    public string? CategoriaVetrina { get; set; }

    /// <summary>
    /// Prezzo mostrato in vetrina. null significa "nessun prezzo di vetrina proprio" e il
    /// consumatore ricade su <see cref="Prezzo"/> — fallback dinamico, valutato a ogni lettura,
    /// così un aggiornamento di listino della cassa si riflette sul sito senza alcuna scrittura
    /// di vetrina. Attenzione: 0 è un valore valorizzato ("omaggio"), non un'assenza.
    /// </summary>
    public decimal? PrezzoVetrina { get; set; }

    public int? ImmagineId { get; set; }
    public MediaAsset? Immagine { get; set; }
    public int OrdinamentoVetrina { get; set; }

    /// <summary>
    /// Testo libero in questa fase, senza tassonomia né normalizzazione dei separatori.
    /// L'assenza ha una sola rappresentazione, null: stringa vuota e soli spazi vengono
    /// persistiti come null, così nessun consumatore deve distinguere fra forme di vuoto.
    /// </summary>
    public string? Allergeni { get; set; }

    public bool Novita { get; set; }
    public bool Consigliato { get; set; }

    /// <summary>
    /// Il giorno in cui questo prodotto sta sulla <b>lavagna</b> — quella vera, all'ingresso, che
    /// cambia ogni mattina. Il sito mostra la lavagna solo per i prodotti il cui valore è
    /// <b>oggi</b>.
    ///
    /// <para>🔴 <b>È una data e non un booleano, e la differenza è la sola cosa che conta qui.</b>
    /// Un <c>InLavagna</c> vero/falso resta acceso finché qualcuno si ricorda di spegnerlo: il
    /// primo lunedì in cui l'amministratore ha fretta, il sito mostra il piatto di venerdì scorso
    /// come «lavagna di oggi» — e continua a mostrarlo per settimane, con la stessa aria di
    /// certezza. Una data <b>scade da sola</b>: dimenticarsene fa sparire la sezione, che è il
    /// modo giusto di sbagliare.</para>
    ///
    /// <para>⚠️ Il confronto con "oggi" è del <b>server</b>, in ora locale del locale, e non del
    /// visitatore: la lavagna è un fatto del posto, non del fuso di chi guarda.</para>
    /// </summary>
    public DateOnly? InLavagnaDal { get; set; }

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Vendita> Vendite { get; set; } = new List<Vendita>();
}
