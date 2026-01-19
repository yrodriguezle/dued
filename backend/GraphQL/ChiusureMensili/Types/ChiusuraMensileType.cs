using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.Authentication;
using duedgusto.GraphQL.MonthlyClosures.Types;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

public class ChiusuraMensileType : ObjectGraphType<ChiusuraMensile>
{
    public ChiusuraMensileType()
    {
        Name = "ChiusuraMensile";
        Field(x => x.ChiusuraId);
        Field("anno", x => x.Anno);
        Field("mese", x => x.Mese);
        Field("ultimoGiornoLavorativo", x => x.UltimoGiornoLavorativo, type: typeof(DateTimeGraphType));
        Field("ricavoTotale", x => x.RicavoTotale, nullable: true);
        Field("totaleContanti", x => x.TotaleContanti, nullable: true);
        Field("totaleElettronici", x => x.TotaleElettronici, nullable: true);
        Field("totaleFatture", x => x.TotaleFatture, nullable: true);
        Field("speseAggiuntive", x => x.SpeseAggiuntive, nullable: true);
        Field("ricavoNetto", x => x.RicavoNetto, nullable: true);
        Field("stato", x => x.Stato);
        Field("note", x => x.Note, nullable: true);
        Field("chiusaDa", x => x.ChiusaDa, nullable: true);
        Field("chiusaIl", x => x.ChiusaIl, typeof(DateTimeGraphType));
        Field("creatoIl", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("aggiornatoIl", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));
        Field<UtenteType, Utente>("chiusaDaUtente")
            .Resolve(context => context.Source.ChiusaDaUtente);
        Field<ListGraphType<MonthlyExpenseType>, IEnumerable<SpesaMensile>>("spese")
            .Resolve(context => context.Source.Spese);
    }
}

