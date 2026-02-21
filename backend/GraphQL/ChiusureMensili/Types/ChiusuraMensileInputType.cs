using duedgusto.GraphQL.MonthlyClosures.Types;
using GraphQL.Types;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

public class ChiusuraMensileInput
{
    public int? ChiusuraId { get; set; }
    public int Anno { get; set; }
    public int Mese { get; set; }
    public string? Note { get; set; }
    public string Stato { get; set; } = "BOZZA";
    public List<SpesaMensileInput>? Spese { get; set; }
}

public class ChiusuraMensileInputType : InputObjectGraphType<ChiusuraMensileInput>
{
    public ChiusuraMensileInputType()
    {
        Name = "ChiusuraMensileInput";

        Field(x => x.ChiusuraId, nullable: true);
        Field(x => x.Anno);
        Field(x => x.Mese);
        Field(x => x.Note, nullable: true);
        Field(x => x.Stato);
        Field<ListGraphType<SpesaMensileInputType>, List<SpesaMensileInput>?>(nameof(ChiusuraMensileInput.Spese));
    }
}

