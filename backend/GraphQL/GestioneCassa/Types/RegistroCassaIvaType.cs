using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa.Types;

public class RegistroCassaIvaType : ObjectGraphType<RegistroCassaIva>
{
    public RegistroCassaIvaType()
    {
        Name = "RegistroCassaIva";
        Field(x => x.Id);
        Field(x => x.RegistroCassaId);
        Field(x => x.Aliquota, type: typeof(DecimalGraphType));
        Field(x => x.Imponibile, type: typeof(DecimalGraphType));
        Field(x => x.Imposta, type: typeof(DecimalGraphType));
        Field(x => x.Stimato);
    }
}
