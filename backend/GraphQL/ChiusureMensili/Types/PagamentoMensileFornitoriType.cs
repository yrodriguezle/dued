using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

/// <summary>
/// GraphQL Type per PagamentoMensileFornitori (join table tra ChiusuraMensile e PagamentoFornitore)
/// </summary>
public class PagamentoMensileFornitoriType : ObjectGraphType<PagamentoMensileFornitori>
{
    public PagamentoMensileFornitoriType()
    {
        Name = "PagamentoMensileFornitori";
        Description = "Associazione tra chiusura mensile e pagamento fornitore";

        Field(x => x.ChiusuraId);
        Field(x => x.PagamentoId);
        Field(x => x.InclusoInChiusura);

        // Navigation properties
        Field<ChiusuraMensileType, ChiusuraMensile>("chiusura")
            .Resolve(context => context.Source.Chiusura);

        // Pagamento fornitore con i suoi dati
        Field<PagamentoFornitoreInfoType, PagamentoFornitore>("pagamento")
            .Resolve(context => context.Source.Pagamento);
    }
}

/// <summary>
/// Type inline per le informazioni base del pagamento fornitore
/// </summary>
public class PagamentoFornitoreInfoType : ObjectGraphType<PagamentoFornitore>
{
    public PagamentoFornitoreInfoType()
    {
        Name = "PagamentoFornitoreInfo";
        Description = "Informazioni base del pagamento fornitore";

        Field(x => x.PagamentoId);
        Field(x => x.FatturaId, nullable: true);
        Field(x => x.DdtId, nullable: true);
        Field(x => x.DataPagamento, type: typeof(DateTimeGraphType));
        Field(x => x.Importo);
        Field(x => x.MetodoPagamento, nullable: true);
        Field(x => x.Note, nullable: true);
        Field(x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field(x => x.AggiornatoIl, type: typeof(DateTimeGraphType));
    }
}
