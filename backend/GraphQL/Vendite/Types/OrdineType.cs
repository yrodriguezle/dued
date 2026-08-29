using GraphQL.Types;

using duedgusto.GraphQL.DataLoaders;
using duedgusto.Models;

namespace duedgusto.GraphQL.Vendite.Types;

/// <summary>
/// Il conto al bancone, letto dal client.
///
/// <para>🔴 <b>Niente <c>resto</c> in questo tipo.</b> Si espone <c>contanteRicevuto</c>, e il resto
/// da rendere è la sottrazione <c>contanteRicevuto − totaleOrdine</c> che il client fa da sé.
/// <c>RegistroCassa.Resto</c> esiste già ed è la colonna AG del foglio di chiusura: riusare quel
/// nome qui creerebbe in UI un equivoco che poi non si toglie più.</para>
///
/// <para>ℹ️ Tre campi sono <b>derivati e mai persistiti</b> — <c>identificativo</c>,
/// <c>dataRegistro</c> e <c>totaleCorrente</c> — sullo stesso principio di
/// <c>prezzoEffettivoVetrina</c>: sono composizioni di colonne che ci sono già, e salvarli
/// creerebbe una seconda fonte di verità da tenere allineata a ogni scrittura.</para>
/// </summary>
public class OrdineType : ObjectGraphType<Ordine>
{
    public OrdineType()
    {
        Field("ordineId", x => x.OrdineId);
        Field("registroCassaId", x => x.RegistroCassaId);
        Field("numero", x => x.Numero);

        // ⚠️ NON nullable, e non è una scelta di comodo: la colonna è varchar(2) NOT NULL DEFAULT ''
        //    perché in un indice unico più NULL sono distinti fra loro, e con la colonna nullable
        //    l'unicità della terna (RegistroCassaId, Numero, SuffissoSplit) smetterebbe di
        //    proteggere il caso normale — l'ordine non splittato. Il contratto lo rispecchia:
        //    stringa vuota, mai null.
        Field<NonNullGraphType<StringGraphType>>("suffissoSplit")
            .Description("\"\" se l'ordine non è splittato, \"A\"/\"B\"/… sui figli di uno split.")
            .Resolve(context => context.Source.SuffissoSplit);

        Field("stato", x => x.Stato);
        Field("metodoPagamento", x => x.MetodoPagamento, nullable: true);
        Field("totaleOrdine", x => x.TotaleOrdine);
        Field("contanteRicevuto", x => x.ContanteRicevuto, nullable: true);
        Field("ordinePadreId", x => x.OrdinePadreId, nullable: true);
        Field("note", x => x.Note, nullable: true);

        // Chi e quando, per ognuna delle transizioni. L'annullo e lo storno senza traccia sarebbero
        // due modi silenziosi di far sparire un incasso: i campi esistono perché la traccia è
        // obbligatoria, e si espongono perché una traccia che nessuno può leggere non è una traccia.
        Field("apertoDa", x => x.ApertoDa, nullable: true);
        Field("apertoIl", x => x.ApertoIl);
        Field("chiusoDa", x => x.ChiusoDa, nullable: true);
        Field("chiusoIl", x => x.ChiusoIl, nullable: true);
        Field("annullatoDa", x => x.AnnullatoDa, nullable: true);
        Field("annullatoIl", x => x.AnnullatoIl, nullable: true);
        Field("motivoAnnullamento", x => x.MotivoAnnullamento, nullable: true);
        Field("stornatoDa", x => x.StornatoDa, nullable: true);
        Field("stornatoIl", x => x.StornatoIl, nullable: true);
        Field("motivoStorno", x => x.MotivoStorno, nullable: true);

        Field("createdAt", x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.UpdatedAt, type: typeof(DateTimeGraphType));

        Field<NonNullGraphType<ListGraphType<NonNullGraphType<RigaOrdineType>>>>("righe")
            .Description("Le voci battute. Su un ordine SPLITTATO è vuota: le righe sono state "
                + "riassegnate ai figli, non duplicate.")
            .Resolve(context => context.GetRigheByOrdineId(context.Source.OrdineId));

        Field<NonNullGraphType<ListGraphType<NonNullGraphType<OrdineType>>>>("figli")
            .Description("I tagli nati da uno split, ciascuno già CHIUSO col proprio metodo di "
                + "pagamento. Vuota su ogni altro ordine.")
            .Resolve(context => context.GetFigliByOrdinePadreId(context.Source.OrdineId));

        // ── I tre campi derivati ─────────────────────────────────────────────────────────────

        Field<NonNullGraphType<StringGraphType>>("identificativo")
            .Description("L'identificativo stampabile: {data:yyMMdd}-{numero:D3}, più -{suffisso} "
                + "sui figli di uno split. Composto in lettura, mai persistito.")
            .ResolveAsync(async context =>
            {
                RegistroCassa? registro = await context
                    .GetRegistroCassaById(context.Source.RegistroCassaId)
                    .GetResultAsync();

                // Il registro non può mancare — la FK è Restrict — ma un identificativo è una
                // stringa da mostrare, non un punto in cui vale la pena far fallire una lettura.
                return TransizioneOrdine.Identificativo(
                    context.Source, registro?.Data ?? context.Source.ApertoIl);
            });

        // 🔴 La data del REGISTRO, non quella di apertura, ed è il campo che rende leggibile la
        //    trappola della mezzanotte: un ordine aperto alle 23:50 e ancora aperto alle 00:05
        //    appartiene al registro di IERI, ed è voluto. L'elenco degli ordini aperti non è
        //    filtrato su oggi proprio per non farlo sparire; questo campo è ciò che permette
        //    all'operatore di vedere che è di ieri invece di crederlo di oggi.
        Field<NonNullGraphType<DateTimeGraphType>>("dataRegistro")
            .Description("La data del registro di cassa a cui l'ordine appartiene. Può essere "
                + "diversa da oggi: un ordine resta sul registro del giorno in cui è stato aperto.")
            .ResolveAsync(async context =>
            {
                RegistroCassa? registro = await context
                    .GetRegistroCassaById(context.Source.RegistroCassaId)
                    .GetResultAsync();
                return registro?.Data ?? context.Source.ApertoIl.Date;
            });

        Field<NonNullGraphType<DecimalGraphType>>("totaleCorrente")
            .Description("Somma delle voci attualmente sull'ordine. È il totale da mostrare "
                + "mentre l'ordine è APERTO, quando totaleOrdine vale ancora 0 perché lo snapshot "
                + "si scrive alla chiusura. Su un ordine SPLITTATO vale 0 — le righe sono dei "
                + "figli — mentre totaleOrdine conserva quanto valeva il conto intero.")
            .ResolveAsync(async context =>
            {
                IEnumerable<RigaOrdine> righe = await context
                    .GetRigheByOrdineId(context.Source.OrdineId)
                    .GetResultAsync();
                return righe.Sum(r => r.PrezzoTotale);
            });
    }
}
