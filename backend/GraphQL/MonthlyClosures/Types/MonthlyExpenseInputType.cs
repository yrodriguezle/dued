using GraphQL.Types;

namespace duedgusto.GraphQL.MonthlyClosures.Types;

public class SpesaMensileInput
{
    public int? SpesaId { get; set; }
    public int? ChiusuraId { get; set; }
    public int? PagamentoId { get; set; }
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    public string? Categoria { get; set; }
}

public class SpesaMensileInputType : InputObjectGraphType<SpesaMensileInput>
{
    public SpesaMensileInputType()
    {
        Name = "SpesaMensileInput";

        Field(x => x.SpesaId, nullable: true);
        Field(x => x.ChiusuraId, nullable: true);
        Field(x => x.PagamentoId, nullable: true);
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        Field(x => x.Categoria, nullable: true);
    }
}

