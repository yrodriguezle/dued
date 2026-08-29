namespace duedgusto.Models;

/// <summary>
/// Una voce battuta dentro un <see cref="Ordine"/>: il prodotto, la quantità, e il prezzo
/// <b>detto al cliente</b> nel momento in cui è stato battuto.
///
/// <para>Non è una vendita: finché l'ordine è aperto questa riga non ha mosso alcun secchio e non
/// esiste alcuna <c>Vendita</c> corrispondente. La <c>Vendita</c> nasce alla chiusura, ereditando
/// da qui prezzo e aliquota.</para>
///
/// <para>Le righe <b>non si cancellano mai</b> per effetto di una transizione dell'ordine —
/// nemmeno allo storno. Sono ciò che rende un ordine stornato distinguibile da un ordine mai
/// esistito.</para>
///
/// <para>⚠️ <b>Niente <c>Imponibile</c> e <c>ImportoIva</c> qui.</b> Lo scorporo IVA è un fatto
/// della vendita <i>incassata</i> e vive in un punto solo, <c>RicalcolaImportiSnapshot</c>, che
/// lo calcola sulla <c>Vendita</c> alla chiusura. Duplicarlo sulla riga creerebbe un secondo luogo
/// in cui l'invariante <c>Imponibile + ImportoIva == PrezzoTotale</c> può divergere.</para>
/// </summary>
public class RigaOrdine
{
    public int RigaOrdineId { get; set; }

    /// <summary>
    /// L'ordine di appartenenza. ⚠️ Su uno split questa FK <b>cambia</b>: la riga passa al figlio
    /// che la incassa, non viene duplicata. Il padre si rilegge attraverso i figli.
    /// </summary>
    public int OrdineId { get; set; }

    public int ProdottoId { get; set; }

    /// <summary>⚠️ <c>decimal</c> e non <c>int</c>, come <c>Vendita.Quantita</c>.</summary>
    public decimal Quantita { get; set; }

    /// <summary>
    /// Snapshot preso <b>quando la voce viene battuta</b>, non alla chiusura: è il prezzo detto al
    /// cliente. Un ritocco di listino a ordine aperto non deve cambiare il conto sotto al cliente.
    /// La <c>Vendita</c> lo eredita alla chiusura.
    /// </summary>
    public decimal PrezzoUnitario { get; set; }

    /// <summary>Snapshot dell'aliquota al momento del tocco, come su <c>Vendita</c>.</summary>
    public decimal AliquotaIva { get; set; }

    /// <summary><c>Quantita * PrezzoUnitario</c>.</summary>
    public decimal PrezzoTotale { get; set; }

    public string? Note { get; set; }

    /// <summary>Quando la voce è stata battuta.</summary>
    public DateTime DataOra { get; set; } = DateTime.UtcNow;

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Ordine Ordine { get; set; } = null!;
    public Prodotto Prodotto { get; set; } = null!;
}
