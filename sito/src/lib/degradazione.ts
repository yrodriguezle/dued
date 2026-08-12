// Il ripiego per quando l'identità del locale non si legge.

/**
 * L'ora da cui vale il registro serale **quando l'API non risponde**.
 *
 * ⚠️ **Cos'è**: un ripiego, usato solo nel ramo `assente`. Nel ramo `ok` il valore arriva
 *    da `oraInizioTemaSera`, che l'amministratore sceglie dall'app di cassa.
 *
 * 🔴 **Cosa NON è**: una seconda sorgente di verità. Nessuna pagina deve leggerlo quando
 *    il dato c'è, e nessuno deve "allinearlo" al valore a database — se un giorno
 *    l'amministratore spostasse il tema serale alle 17:00, questa riga resterebbe 18:00 ed
 *    è **corretto** che resti: descrive il comportamento del sito quando non sa niente,
 *    non l'orario del locale.
 *
 * Il suo unico effetto se sbagliato è spostare di qualche ora un tema automatico su una
 * pagina che sta già **dichiarando** di essere incompleta. È il motivo per cui può essere
 * una costante e non un problema.
 */
export const ORA_TEMA_SERA_DI_RIPIEGO = '18:00';
