using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.ChiusureMensili.Types;
using duedgusto.GraphQL.DataLoaders;

namespace duedgusto.GraphQL.Fornitori.Types;

public class PagamentoFornitoreType : ObjectGraphType<PagamentoFornitore>
{
    public PagamentoFornitoreType()
    {
        Name = "PagamentoFornitore";

        Field("pagamentoId", x => x.PagamentoId);
        Field("fatturaId", x => x.FatturaId, nullable: true);
        Field("ddtId", x => x.DdtId, nullable: true);
        // Origine del pagamento: null = origine-chiusura (editabile in chiusura),
        // valorizzato = proveniente da un registro cassa (read-only in chiusura).
        Field("registroCassaId", x => x.RegistroCassaId, nullable: true);
        Field("dataPagamento", x => x.DataPagamento, type: typeof(DateTimeGraphType));
        Field("importo", x => x.Importo);
        Field("metodoPagamento", x => x.MetodoPagamento, nullable: true);
        // Categoria (nullable): valorizzata solo per le spese fisse pagate in modo tracciato,
        // NULL per i pagamenti documentali (fatture/DDT fornitori).
        Field<EnumerationGraphType<CategoriaSpesa>>("categoria")
            .Resolve(context => context.Source.Categoria);
        Field("note", x => x.Note, nullable: true);
        Field("createdAt", x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.UpdatedAt, type: typeof(DateTimeGraphType));

        Field<FatturaAcquistoType>("fattura")
            .Resolve(context => context.Source.FatturaId is { } fk
                ? context.GetFatturaById(fk)
                : null);

        Field<DocumentoTrasportoType>("ddt")
            .Resolve(context => context.Source.DdtId is { } fk
                ? context.GetDdtById(fk)
                : null);
    }
}
