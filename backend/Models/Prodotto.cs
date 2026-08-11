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

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Vendita> Vendite { get; set; } = new List<Vendita>();
}
