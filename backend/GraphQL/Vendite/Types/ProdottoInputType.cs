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
    }
}
