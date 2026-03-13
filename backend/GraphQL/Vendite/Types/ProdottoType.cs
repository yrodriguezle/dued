using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Vendite.Types;

public class ProdottoType : ObjectGraphType<Prodotto>
{
    public ProdottoType()
    {
        Field("prodottoId", x => x.ProdottoId);
        Field("codice", x => x.Codice);
        Field("nome", x => x.Nome);
        Field("descrizione", x => x.Descrizione, nullable: true);
        Field("prezzo", x => x.Prezzo);
        Field("categoria", x => x.Categoria, nullable: true);
        Field("unitaDiMisura", x => x.UnitaDiMisura);
        Field("attivo", x => x.Attivo);
        Field("creatoIl", x => x.CreatoIl);
        Field("aggiornatoIl", x => x.AggiornatoIl);
    }
}
