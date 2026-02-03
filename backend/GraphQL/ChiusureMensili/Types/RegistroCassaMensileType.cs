using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.CashManagement.Types;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

/// <summary>
/// GraphQL Type per RegistroCassaMensile (join table tra ChiusuraMensile e RegistroCassa)
/// </summary>
public class RegistroCassaMensileType : ObjectGraphType<RegistroCassaMensile>
{
    public RegistroCassaMensileType()
    {
        Name = "RegistroCassaMensile";
        Description = "Associazione tra chiusura mensile e registro cassa giornaliero";

        Field(x => x.ChiusuraId);
        Field(x => x.RegistroId);
        Field(x => x.Incluso);

        // Navigation properties
        Field<ChiusuraMensileType, ChiusuraMensile>("chiusura")
            .Resolve(context => context.Source.Chiusura);

        Field<RegistroCassaType, RegistroCassa>("registro")
            .Resolve(context => context.Source.Registro);
    }
}
