using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models;

/// <summary>
/// Un <b>raggruppamento libero</b> di prodotti, per dare al punto vendita un tasto solo dove
/// oggi ce ne sono dieci: «Spritz» apre Aperol, Campari, Cynar, Hugo, liscio.
///
/// <para>🔴 <b>Libero significa deciso dall'utente, non derivato.</b> Non è la categoria
/// contabile (<see cref="Prodotto.Categoria"/>) e non è una fascia di prezzo: un gruppo è un
/// livello <i>sopra</i> i prodotti, e serve proprio a tagliare di traverso — le varianti di uno
/// spritz stanno in categorie e prezzi diversi e restano lo stesso gesto al banco.</para>
///
/// <para>🔴 <b>Nessun prezzo sul gruppo.</b> Il tastone mostra «da X €» calcolato in lettura dal
/// minimo dei membri attivi, e quel valore non si persiste mai: un prezzo indicativo salvato
/// invecchia in silenzio, e diverge dal listino il giorno in cui qualcuno ritocca una variante
/// senza ripassare di qui.</para>
///
/// <para>⚠️ Il <see cref="Colore"/> qui è quello del <b>tastone del gruppo</b>. Il colore delle
/// singole varianti sta su <see cref="Prodotto.Colore"/>: sono due cose diverse e nessuna delle
/// due si deriva dall'altra.</para>
/// </summary>
public class GruppoProdotti
{
    public int GruppoProdottiId { get; set; }

    /// <summary>
    /// Chiave stabile del gruppo, univoca. Serve al seed e ai riferimenti, e non cambia quando
    /// cambia il nome mostrato.
    /// </summary>
    public string Codice { get; set; } = string.Empty;

    /// <summary>L'etichetta sul tastone: «Spritz», «Caffè», «Cocktail».</summary>
    public string Nome { get; set; } = string.Empty;

    /// <summary>
    /// Colore esplicito del tastone del gruppo. <c>null</c> significa «usa il colore generato»,
    /// come per i prodotti senza colore proprio.
    /// </summary>
    public string? Colore { get; set; }

    /// <summary>
    /// Ordine del tastone nella griglia principale, con lo stesso significato di
    /// <see cref="Prodotto.Ordinamento"/>: <c>0</c> è «mai ordinato», non «primo».
    /// </summary>
    public int Ordinamento { get; set; }

    /// <summary>
    /// Un gruppo spento sparisce dalla griglia ma non porta via i suoi membri, che restano
    /// prodotti a sé e ricompaiono fra quelli non raggruppati.
    /// </summary>
    public bool Attivo { get; set; } = true;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<ProdottoGruppo> Membri { get; set; } = new List<ProdottoGruppo>();
}

/// <summary>
/// L'appartenenza di un prodotto a un gruppo: <b>entità di join esplicita</b>, con chiave
/// composita e un dato proprio.
///
/// <para>🔴 <b>Molti-a-molti, e la decisione ha una ragione asimmetrica.</b> Un prodotto può
/// stare in più gruppi — lo stesso spritz sotto «Spritz» e sotto «Aperitivi». Passare da 1:N a
/// N:N più avanti sarebbe una migrazione <i>con dati dentro</i>; il contrario non serve mai,
/// perché un molti-a-molti usato con un gruppo solo per prodotto si comporta come un 1:N.</para>
///
/// <para>⚠️ <b>Join esplicita e non <c>UsingEntity&lt;Dictionary&lt;string, object&gt;&gt;</c></b>
/// come <c>RuoloMenu</c>: quel pattern non regge un payload in modo leggibile né tipizzato, e
/// qui il payload c'è. Lo stampo è <see cref="RegistroCassaMensile"/>, che ha esattamente questa
/// forma — chiave composita più un dato sull'appartenenza.</para>
/// </summary>
[Table("ProdottiGruppi")]
public class ProdottoGruppo
{
    public int GruppoProdottiId { get; set; }

    public int ProdottoId { get; set; }

    /// <summary>
    /// L'ordine della variante <b>dentro il gruppo</b>, con pareggio su <c>Prodotto.Codice</c>.
    ///
    /// <para>⚠️ Sta sull'appartenenza e non sul prodotto perché è <b>per gruppo</b>: lo stesso
    /// spritz può essere il primo sotto «Spritz» e il terzo sotto «Aperitivi», e un campo sul
    /// prodotto costringerebbe i due gruppi a condividere un ordine che non hanno motivo di
    /// condividere.</para>
    /// </summary>
    public int Ordinamento { get; set; }

    [ForeignKey("GruppoProdottiId")]
    public GruppoProdotti Gruppo { get; set; } = null!;

    [ForeignKey("ProdottoId")]
    public Prodotto Prodotto { get; set; } = null!;
}
