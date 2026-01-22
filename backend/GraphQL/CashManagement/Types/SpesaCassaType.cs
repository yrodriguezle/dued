using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement.Types;

public class SpesaCassaType : ObjectGraphType<SpesaCassa>
{
    public SpesaCassaType()
    {
        Name = "SpesaCassa";
        Field(x => x.Id);
        Field(x => x.RegistroCassaId);
        Field(x => x.Descrizione);
        Field(x => x.Importo, type: typeof(DecimalGraphType));
    }
}

public class SpesaCassaInput
{
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
}

public class SpesaCassaInputType : InputObjectGraphType<SpesaCassaInput>
{
    public SpesaCassaInputType()
    {
        Name = "SpesaCassaInput";
        Field(x => x.Descrizione);
        Field(x => x.Importo);
    }
}
