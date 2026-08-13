using GraphQL.Types;

namespace duedgusto.GraphQL.Vendite.Types;

public class CreaVenditaInput
{
    public int RegistroCassaId { get; set; }
    public int ProdottoId { get; set; }
    public decimal Quantita { get; set; }
    public string? Note { get; set; }
    public DateTime? DataOra { get; set; }

    /// <summary>
    /// Uno dei tre valori di <c>MetodiPagamentoVendita</c>. <b>Opzionale</b>: omesso vale
    /// contante non tracciato, cioè il metodo che non muove alcun secchio del registro.
    ///
    /// <para>⚠️ Opzionale non vuol dire trascurabile — è il campo che decide dove finiscono i
    /// soldi. È nullable perché il default sicuro esiste ed è quello che non gonfia niente:
    /// un chiamante distratto sbaglia per difetto, non per eccesso.</para>
    /// </summary>
    public string? MetodoPagamento { get; set; }
}

public class CreaVenditaInputType : InputObjectGraphType<CreaVenditaInput>
{
    public CreaVenditaInputType()
    {
        Field(x => x.RegistroCassaId);
        Field(x => x.ProdottoId);
        Field(x => x.Quantita);
        Field(x => x.Note, nullable: true);
        Field(x => x.DataOra, type: typeof(DateTimeGraphType));
        Field(x => x.MetodoPagamento, nullable: true);
    }
}
