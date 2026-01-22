using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement.Types;

public class IncassoCassaType : ObjectGraphType<IncassoCassa>
{
    public IncassoCassaType()
    {
        Name = "IncassoCassa";
        Field(x => x.Id);
        Field(x => x.RegistroCassaId);
        Field(x => x.Tipo);
        Field(x => x.Importo, type: typeof(DecimalGraphType));
    }
}

public class IncassoCassaInput
{
    public string Tipo { get; set; } = string.Empty;
    public decimal Importo { get; set; }
}

public class IncassoCassaInputType : InputObjectGraphType<IncassoCassaInput>
{
    public IncassoCassaInputType()
    {
        Name = "IncassoCassaInput";
        Field(x => x.Tipo);
        Field(x => x.Importo);
    }
}
