using GraphQL.Types;

namespace duedgusto.GraphQL.Fornitori.Types;

public class FornitoreInput
{
    public int? FornitoreId { get; set; }
    public string RagioneSociale { get; set; } = string.Empty;
    public string? PartitaIva { get; set; }
    public string? CodiceFiscale { get; set; }
    public string? Email { get; set; }
    public string? Telefono { get; set; }
    public string? Indirizzo { get; set; }
    public string? Citta { get; set; }
    public string? Cap { get; set; }
    public string? Provincia { get; set; }
    public string? Paese { get; set; }
    public string? Note { get; set; }
    public bool Attivo { get; set; } = true;
    public decimal? AliquotaIva { get; set; } = 22m;
}

public class FornitoreInputType : InputObjectGraphType<FornitoreInput>
{
    public FornitoreInputType()
    {
        Name = "FornitoreInput";

        Field(x => x.FornitoreId, nullable: true);
        Field(x => x.RagioneSociale);
        Field(x => x.PartitaIva, nullable: true);
        Field(x => x.CodiceFiscale, nullable: true);
        Field(x => x.Email, nullable: true);
        Field(x => x.Telefono, nullable: true);
        Field(x => x.Indirizzo, nullable: true);
        Field(x => x.Citta, nullable: true);
        Field(x => x.Cap, nullable: true);
        Field(x => x.Provincia, nullable: true);
        Field(x => x.Paese, nullable: true);
        Field(x => x.Note, nullable: true);
        Field(x => x.Attivo);
        Field(x => x.AliquotaIva, nullable: true);
    }
}
