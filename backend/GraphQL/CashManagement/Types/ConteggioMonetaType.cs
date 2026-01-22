using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.CashManagement.Types;

public class ConteggioMonetaType : ObjectGraphType<ConteggioMoneta>
{
    public ConteggioMonetaType()
    {
        Name = "ConteggioMoneta";
        Field(x => x.Id);
        Field(x => x.RegistroCassaId);
        Field(x => x.DenominazioneMonetaId);
        Field(x => x.Quantita);
        Field(x => x.Totale);
        Field(x => x.IsApertura);
        Field<DenominazioneMonetaType, DenominazioneMoneta>("denominazione")
            .Resolve(context => context.Source.Denominazione);
    }
}

public class ConteggioMonetaInput
{
    public int DenominazioneMonetaId { get; set; }
    public int Quantita { get; set; }
}

public class ConteggioMonetaInputType : InputObjectGraphType<ConteggioMonetaInput>
{
    public ConteggioMonetaInputType()
    {
        Name = "ConteggioMonetaInput";
        Field(x => x.DenominazioneMonetaId);
        Field(x => x.Quantita);
    }
}
