using duedgusto.Models;

namespace duedgusto.Services.Calendario;

/// <summary>
/// La regola con cui un <see cref="GiornoNonLavorativo"/> diventa una <b>data</b>, in un posto
/// solo.
///
/// <para>🔴 <b>Perché esiste questa classe.</b> La regola di ricorrenza — «se ricorrente confronta
/// mese e giorno, altrimenti la data esatta» — viveva scritta a mano dentro
/// <c>ChiusuraMensileValidator</c>. Serviva un secondo lettore (la rotta pubblica che alimenta il
/// sito) e il modo più breve sarebbe stato riscriverla lì: due copie della stessa condizione, su
/// due lati che <b>devono</b> concordare. Il giorno in cui divergessero, la cassa non pretenderebbe
/// il registro del 25 dicembre e il sito direbbe «aperto» — cioè il guasto peggiore possibile per
/// un dato pubblico, senza un errore da nessuna parte.</para>
///
/// <para>⚠️ Il calendario delle chiusure NON è l'orario settimanale. L'orario ricorrente sta in
/// <c>BusinessSettings</c> ed è già la sorgente unica di apertura, chiusura e giorni operativi;
/// questo è l'<b>elenco delle eccezioni</b> a quell'orario. I due si compongono con un AND — chiuso
/// se il giorno della settimana non è operativo <b>oppure</b> se la data è un giorno non
/// lavorativo — e chi ne legge uno solo racconta metà della verità.</para>
/// </summary>
public static class ChiusureProgrammate
{
    /// <summary>
    /// Quanti giorni avanti guarda la vetrina, <b>oggi compreso</b>.
    ///
    /// <para>È un numero solo e fa due mestieri, deliberatamente: è la finestra in cui il sito
    /// <b>annuncia</b> una chiusura futura ed è l'insieme in cui lo script cerca <b>oggi</b> per
    /// accendere «Chiuso». Tenerne due — uno per l'avviso, uno per la pastiglia — significherebbe
    /// poterli far divergere, e la forma della divergenza sarebbe una pagina che annuncia una
    /// chiusura senza dichiararsi chiusa.</para>
    ///
    /// <para>⚠️ Sessanta e non quattordici: una chiusura estiva di tre settimane deve entrare
    /// <b>per intero</b> nella finestra, altrimenti l'avviso ne mostrerebbe la coda tagliata — «dal
    /// 10 al 23» invece che «al 30» — che è peggio di non mostrarlo, perché è una data sbagliata
    /// detta con sicurezza.</para>
    /// </summary>
    public const int GiorniDiOrizzonte = 60;

    /// <summary>
    /// Il tetto alle righe lette dal database. Non protegge da un input — la rotta pubblica non ne
    /// accetta — ma tiene il costo della risposta <b>fisso</b> anche se un giorno la tabella
    /// crescesse: i ricorrenti non sono filtrabili per data in SQL e vengono letti tutti.
    /// </summary>
    public const int MaxRigheLette = 500;

    /// <summary>
    /// Se <paramref name="giorno"/> cade il <paramref name="data"/>.
    ///
    /// <para>⚠️ Il ricorrente confronta <b>mese e giorno</b> e ignora l'anno: è il modo in cui la
    /// cassa ha sempre inteso quel flag (una festività nazionale vale ogni anno) e cambiarlo qui
    /// significherebbe cambiarlo per la chiusura mensile. Conseguenza da conoscere: un ricorrente
    /// registrato al <b>29 febbraio</b> non cade mai negli anni non bisestili, e questo è corretto —
    /// quel giorno non esiste.</para>
    /// </summary>
    public static bool CadeIl(GiornoNonLavorativo giorno, DateOnly data) =>
        giorno.Ricorrente
            ? giorno.Data.Month == data.Month && giorno.Data.Day == data.Day
            : giorno.Data == data;

    /// <summary>
    /// Le date chiuse nella finestra <c>[da, da + giorni - 1]</c>, in ordine crescente e con
    /// <b>una sola voce per data</b>.
    ///
    /// <para>🔴 Si itera sui <b>giorni</b> e non sulle righe, ed è la scelta che rende il risultato
    /// deduplicato per costruzione: una data coperta sia da una chiusura specifica sia da una
    /// ricorrenza compare una volta. Senza, l'avviso in pagina mostrerebbe «Ferie» e «Ferragosto»
    /// sullo stesso 15 agosto, e chi lo legge non saprebbe quale delle due è.</para>
    ///
    /// <para>⚠️ A pari data vince la voce <b>non ricorrente</b>: qualcuno l'ha inserita per
    /// <i>quel</i> giorno, quindi ne sa più di una regola annuale. La precedenza la stabilisce
    /// l'ordine con cui arriva <paramref name="giorni"/> — è il chiamante a ordinarla, e la rotta
    /// pubblica lo fa in SQL.</para>
    /// </summary>
    public static IReadOnlyList<(DateOnly Data, GiornoNonLavorativo Giorno)> NellaFinestra(
        IEnumerable<GiornoNonLavorativo> giorni,
        DateOnly da,
        int perGiorni = GiorniDiOrizzonte)
    {
        List<GiornoNonLavorativo> elenco = giorni.ToList();
        var chiuse = new List<(DateOnly, GiornoNonLavorativo)>();

        for (int passo = 0; passo < perGiorni; passo++)
        {
            DateOnly data = da.AddDays(passo);
            GiornoNonLavorativo? primo = elenco.FirstOrDefault(giorno => CadeIl(giorno, data));
            if (primo is not null)
            {
                chiuse.Add((data, primo));
            }
        }

        return chiuse;
    }
}
