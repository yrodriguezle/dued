using duedgusto.Common;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Muove <c>IncassiElettronici</c> e <c>IncassoContanteTracciato</c> quando una vendita nasce,
/// cambia o sparisce.
///
/// <para>🔴 <b>Perché per delta e non ricalcolando da capo.</b> È la differenza fondamentale
/// con <see cref="BreakdownIvaApplier"/>, che sta nel file accanto e fa il contrario. I due
/// campi restano <b>digitabili a mano</b> nella scheda del registro: battere dall'app ci si può
/// dimenticare, e un campo che si rifiuta di farsi correggere trasformerebbe una dimenticanza
/// in un incasso perso. Ricalcolarli dalla somma delle vendite cancellerebbe il valore digitato
/// al primo salvataggio del registro — quindi qui si <i>somma</i> e si <i>sottrae</i>, e il
/// numero digitato sopravvive.</para>
///
/// <para>Sullo stesso registro convivono perciò due regimi, ed è voluto:</para>
/// <list type="bullet">
/// <item><description><c>VenditeContanti</c>, <c>TotaleVendite</c>, breakdown IVA — ricalcolati
/// da capo dalle vendite persistite, da <see cref="BreakdownIvaApplier"/>.</description></item>
/// <item><description><c>IncassiElettronici</c>, <c>IncassoContanteTracciato</c> — digitabili,
/// mossi per delta da qui.</description></item>
/// </list>
///
/// <para>⚠️ <b>Il delta non è idempotente per costruzione.</b> Applicarlo due volte per la
/// stessa vendita raddoppia l'importo, e nessun controllo a valle se ne accorgerebbe: va
/// invocato una volta sola per ogni transizione, e mai da un ritentativo automatico.</para>
///
/// <para>⚠️ Va invocato <b>prima</b> di <see cref="BreakdownIvaApplier"/>: quello ricalcola
/// <c>TotaleVendite</c> a partire da <c>IncassiElettronici</c>, e leggerlo prima
/// dell'aggiornamento darebbe un totale vecchio di una riga.</para>
/// </summary>
public static class SecchiIncassiApplier
{
    /// <summary>
    /// Somma <paramref name="importo"/> (negativo per togliere) al secchio del metodo indicato.
    /// NON chiama SaveChanges: il commit è del chiamante.
    /// </summary>
    public static void ApplicaDelta(RegistroCassa registro, string? metodo, decimal importo, ILogger logger)
    {
        if (importo == 0m)
        {
            return;
        }

        switch (metodo)
        {
            case MetodiPagamentoVendita.Elettronico:
                registro.IncassiElettronici = NonNegativo(
                    registro.IncassiElettronici + importo, registro, nameof(registro.IncassiElettronici), logger);
                break;

            case MetodiPagamentoVendita.ContanteTracciato:
                registro.IncassoContanteTracciato = NonNegativo(
                    registro.IncassoContanteTracciato + importo, registro, nameof(registro.IncassoContanteTracciato), logger);
                break;

            case MetodiPagamentoVendita.ContanteNonTracciato:
                // Nessun campo da toccare: quei soldi sono già dentro Chiusura − Apertura, e il
                // non tracciato è il residuo Ecc, calcolato per differenza. Vedi
                // MetodiPagamentoVendita.ContanteNonTracciato per il perché per esteso.
                break;

            default:
                // Una vendita senza metodo riconosciuto non deve far esplodere la cassa: si
                // comporta come il non tracciato — nessun secchio mosso — e lascia una traccia.
                logger.LogWarning(
                    "Vendita con metodo di pagamento non riconosciuto ({Metodo}) sul registro {RegistroCassaId}: nessun secchio aggiornato.",
                    metodo ?? "<null>", registro.Id);
                break;
        }
    }

    /// <summary>
    /// Un secchio negativo non significa niente: nessuno incassa −12 € di POS. Può succedere
    /// eliminando una vendita dopo che qualcuno ha abbassato a mano il totale digitato. Si
    /// porta a zero e si dice che è successo — come il residuo IVA, la cassa non si blocca mai.
    /// </summary>
    private static decimal NonNegativo(decimal valore, RegistroCassa registro, string campo, ILogger logger)
    {
        if (valore >= 0m)
        {
            return valore;
        }

        logger.LogWarning(
            "Registro {RegistroCassaId}: {Campo} sarebbe andato a {Valore}. Portato a 0 — probabile disallineamento fra vendite battute e totale digitato a mano.",
            registro.Id, campo, valore);
        return 0m;
    }
}
