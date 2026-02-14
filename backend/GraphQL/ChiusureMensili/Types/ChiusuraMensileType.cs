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

        // ✅ PROPRIETÀ CALCOLATE (modello referenziale puro)
        Field<DecimalGraphType>("ricavoTotaleCalcolato")
            .Description("Ricavo totale calcolato dalla somma dei registri cassa inclusi")
            .Resolve(context => context.Source.RicavoTotaleCalcolato);

        Field<DecimalGraphType>("totaleContantiCalcolato")
            .Description("Totale contanti calcolato dalla somma dei registri cassa inclusi")
            .Resolve(context => context.Source.TotaleContantiCalcolato);

        Field<DecimalGraphType>("totaleElettroniciCalcolato")
            .Description("Totale pagamenti elettronici calcolato dalla somma dei registri cassa inclusi")
            .Resolve(context => context.Source.TotaleElettroniciCalcolato);

        Field<DecimalGraphType>("totaleFattureCalcolato")
            .Description("Totale fatture calcolato dalla somma dei registri cassa inclusi")
            .Resolve(context => context.Source.TotaleFattureCalcolato);

        Field<DecimalGraphType>("speseAggiuntiveCalcolate")
            .Description("Spese aggiuntive calcolate dalla somma di spese libere + pagamenti fornitori")
            .Resolve(context => context.Source.SpeseAggiuntiveCalcolate);

        Field<DecimalGraphType>("ricavoNettoCalcolato")
            .Description("Ricavo netto calcolato (ricavo totale - spese aggiuntive)")
            .Resolve(context => context.Source.RicavoNettoCalcolato);

        Field<DecimalGraphType>("totaleIvaCalcolato")
            .Description("Totale IVA calcolato dalla somma di ImportoIva dei registri cassa inclusi")
            .Resolve(context => context.Source.TotaleIvaCalcolato);

        Field<DecimalGraphType>("totaleImponibileCalcolato")
            .Description("Totale imponibile calcolato (ricavo totale - IVA)")
            .Resolve(context => context.Source.TotaleImponibileCalcolato);

        Field<DecimalGraphType>("totaleLordoCalcolato")
            .Description("Totale lordo calcolato (alias di ricavo totale)")
            .Resolve(context => context.Source.TotaleLordoCalcolato);

        Field<DecimalGraphType>("totaleDifferenzeCassaCalcolato")
            .Description("Totale differenze di cassa aggregate dai registri giornalieri")
            .Resolve(context => context.Source.TotaleDifferenzeCassaCalcolato);

        Field("stato", x => x.Stato);
        Field("note", x => x.Note, nullable: true);
        Field("chiusaDa", x => x.ChiusaDa, nullable: true);
        Field("chiusaIl", x => x.ChiusaIl, typeof(DateTimeGraphType));
        Field("creatoIl", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("aggiornatoIl", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        // Navigation properties
        Field<UtenteType, Utente>("chiusaDaUtente")
            .Resolve(context => context.Source.ChiusaDaUtente);

        // ✅ NAVIGATION PROPERTIES (modello referenziale puro)
        Field<ListGraphType<RegistroCassaMensileType>, IEnumerable<RegistroCassaMensile>>("registriInclusi")
            .Description("Registri cassa giornalieri inclusi in questa chiusura")
            .Resolve(context => context.Source.RegistriInclusi);

        Field<ListGraphType<SpesaMensileTyperaType>, IEnumerable<SpesaMensileLibera>>("speseLibere")
            .Description("Spese mensili libere (affitto, utenze, stipendi, altro)")
            .Resolve(context => context.Source.SpeseLibere);

        Field<ListGraphType<PagamentoMensileFornitoriType>, IEnumerable<PagamentoMensileFornitori>>("pagamentiInclusi")
            .Description("Pagamenti fornitori inclusi in questa chiusura")
            .Resolve(context => context.Source.PagamentiInclusi);
    }
}

