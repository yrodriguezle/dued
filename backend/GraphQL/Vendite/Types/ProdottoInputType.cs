using GraphQL.Types;

namespace duedgusto.GraphQL.Vendite.Types;

public class ProdottoInput
{
    public int? ProdottoId { get; set; } // null/0 = creazione, valorizzato = aggiornamento
    public string Codice { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Descrizione { get; set; }
    public decimal Prezzo { get; set; }
    public string? Categoria { get; set; }
    public string? UnitaDiMisura { get; set; }
    public bool Attivo { get; set; } = true;

    /// <summary>Aliquota IVA in PERCENTUALE; ammesse: 0, 4, 5, 10, 22. Default 22.</summary>
    public decimal AliquotaIva { get; set; } = 22m;

    /// <summary>
    /// Ordine della tessera nella griglia del punto vendita, dentro la sua categoria.
    ///
    /// <para>🔴 <b>Nullable, e non un <c>int</c> secco.</b> UpsertProdottoAsync assegna ogni
    /// campo esplicitamente: un intero non nullable qui verrebbe riportato a 0 da ogni
    /// chiamante che non lo invia, e l'ordine scelto al banco si perderebbe in silenzio a ogni
    /// modifica di prezzo. <c>null</c> significa «non toccare», come per UnitaDiMisura.</para>
    /// </summary>
    public int? Ordinamento { get; set; }

    /// <summary>
    /// Colore editoriale della tessera (quello della bevanda), che vince sul colore generato
    /// dalla categoria.
    ///
    /// <para>⚠️ Tre valori, tre intenzioni: <c>null</c> è «non toccare», una stringa è il
    /// colore, la <b>stringa vuota</b> è «togli il colore» e torna a null. Senza il terzo caso
    /// un colore messo per sbaglio non si potrebbe più rimuovere, perché `null` è già preso da
    /// «non toccare» — che è ciò che serve a non azzerarlo a ogni ritocco di prezzo.</para>
    /// </summary>
    public string? Colore { get; set; }
}

public class ProdottoInputType : InputObjectGraphType<ProdottoInput>
{
    public ProdottoInputType()
    {
        Field(x => x.ProdottoId, nullable: true);
        Field(x => x.Codice);
        Field(x => x.Nome);
        Field(x => x.Descrizione, nullable: true);
        Field(x => x.Prezzo);
        Field(x => x.Categoria, nullable: true);
        Field(x => x.UnitaDiMisura, nullable: true);
        Field(x => x.Attivo, nullable: true);
        Field(x => x.AliquotaIva, nullable: true);
        Field(x => x.Ordinamento, nullable: true);
        Field(x => x.Colore, nullable: true);
    }
}
