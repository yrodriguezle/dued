using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Fornitori.Types;

public class FornitoreType : ObjectGraphType<Fornitore>
{
    public FornitoreType()
    {
        Name = "Fornitore";

        Field("fornitoreId", x => x.FornitoreId);
        Field("ragioneSociale", x => x.RagioneSociale);
        Field("partitaIva", x => x.PartitaIva, nullable: true);
        Field("codiceFiscale", x => x.CodiceFiscale, nullable: true);
        Field("email", x => x.Email, nullable: true);
        Field("telefono", x => x.Telefono, nullable: true);
        Field("indirizzo", x => x.Indirizzo, nullable: true);
        Field("citta", x => x.Citta, nullable: true);
        Field("cap", x => x.Cap, nullable: true);
        Field("provincia", x => x.Provincia, nullable: true);
        Field("paese", x => x.Paese);
        Field("note", x => x.Note, nullable: true);
        Field("attivo", x => x.Attivo);
        Field("creatoIl", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("aggiornatoIl", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<ListGraphType<FatturaAcquistoType>, IEnumerable<FatturaAcquisto>>("fattureAcquisto")
            .Resolve(context => context.Source.FattureAcquisto);

        Field<ListGraphType<DocumentoTrasportoType>, IEnumerable<DocumentoTrasporto>>("documentiTrasporto")
            .Resolve(context => context.Source.DocumentiTrasporto);
    }
}
