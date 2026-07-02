using GraphQL.Types;
using duedgusto.Common;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Riga IVA a credito (acquisti) del registro cassa — dato gestionale di cassa, non fiscale.
/// Vedi <see cref="RigaBreakdownIvaCredito"/> per la semantica di Fonte/Stimato/AliquotaMista.
/// </summary>
public class RegistroCassaIvaCreditoType : ObjectGraphType<RigaBreakdownIvaCredito>
{
    public RegistroCassaIvaCreditoType()
    {
        Name = "RegistroCassaIvaCredito";
        Field(x => x.Aliquota, type: typeof(DecimalGraphType));
        Field(x => x.Imponibile, type: typeof(DecimalGraphType));
        Field(x => x.Imposta, type: typeof(DecimalGraphType));
        Field(x => x.Fonte);
        Field(x => x.Stimato);
        Field(x => x.AliquotaMista);
    }
}
