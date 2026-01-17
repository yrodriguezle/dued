using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.Authentication;

namespace duedgusto.GraphQL.MonthlyClosures.Types;

public class MonthlyClosureType : ObjectGraphType<ChiusuraMensile>
{
    public MonthlyClosureType()
    {
        Name = "MonthlyClosure";

        Field("closureId", x => x.ChiusuraId);
        Field("year", x => x.Anno);
        Field("month", x => x.Mese);
        Field("lastWorkingDay", x => x.UltimoGiornoLavorativo, type: typeof(DateTimeGraphType));
        Field("totalRevenue", x => x.RicavoTotale, nullable: true);
        Field("totalCash", x => x.TotaleContanti, nullable: true);
        Field("totalElectronic", x => x.TotaleElettronici, nullable: true);
        Field("totalInvoices", x => x.TotaleFatture, nullable: true);
        Field("additionalExpenses", x => x.SpeseAggiuntive, nullable: true);
        Field("netRevenue", x => x.RicavoNetto, nullable: true);
        Field("status", x => x.Stato);
        Field("notes", x => x.Note, nullable: true);
        Field("closedBy", x => x.ChiusaDa, nullable: true);
        Field("closedAt", x => x.ChiusaIl, nullable: true, type: typeof(DateTimeGraphType));
        Field("createdAt", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<UserType, User>("closedByUser")
            .Resolve(context => context.Source.ChiusaDaUtente);

        Field<ListGraphType<MonthlyExpenseType>, IEnumerable<SpesaMensile>>("expenses")
            .Resolve(context => context.Source.Spese);
    }
}
