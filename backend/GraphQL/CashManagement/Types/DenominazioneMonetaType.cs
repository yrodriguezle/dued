using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement.Types;

public class DenominazioneMonetaType : ObjectGraphType<DenominazioneMoneta>
{
    public DenominazioneMonetaType()
    {
        Name = "DenominazioneMoneta";
        Field(x => x.Id);
        Field(x => x.Valore);
        Field(x => x.Tipo);
        Field(x => x.OrdineVisualizzazione);
    }
}
