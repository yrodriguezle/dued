namespace duedgusto.Controllers.Public.Dto;

/// <summary>
/// Il menu pubblico: i prodotti raggruppati per categoria di vetrina, più i tre numeri che
/// rendono il troncamento <b>dichiarato</b> invece che silenzioso.
///
/// <para>🔴 <see cref="TotaleProdottiPubblicati"/> è il conteggio <b>reale</b> ottenuto con lo
/// stesso predicato di pubblicazione, non la lunghezza della lista restituita: se coincidesse
/// con la lista, non direbbe nulla. <see cref="LimiteApplicato"/> arriva dal server perché il
/// consumatore non deve indovinarlo, e <see cref="Troncato"/> esiste perché nessuno deve
/// dedurlo confrontando due numeri.</para>
/// </summary>
public record MenuPubblicoDto(
    IReadOnlyList<CategoriaMenuDto> Categorie,
    int TotaleProdottiPubblicati,
    int LimiteApplicato,
    bool Troncato);

/// <summary>
/// Un raggruppamento del menu.
///
/// <para>⚠️ <b>Il campo si chiama <see cref="Nome"/> e non <c>Categoria</c></b>, e non è un
/// cavillo: <c>Categoria</c> è il nome della categoria <i>contabile</i> del listino ed è
/// nell'elenco dei nomi vietati in una risposta pubblica. Il divieto vale anche qui, dove la
/// categoria è quella di vetrina ed è legittima — perché un nome ambiguo fra due domini è la
/// strada più breve perché l'etichetta di magazzino ("BEVANDE") finisca come intestazione sul
/// sito. Il contenitore si chiama <c>Categorie</c> (plurale) e non è ambiguo.</para>
/// </summary>
public record CategoriaMenuDto(
    string Nome,
    IReadOnlyList<ProdottoPubblicoDto> Prodotti);

/// <summary>
/// Un prodotto come lo vede il cliente. Possiede <b>soltanto</b> questi campi: non esiste una
/// property da cui possa uscire il codice di listino, l'aliquota IVA, l'unità di misura o lo
/// stato di attività in cassa.
///
/// <para>⚠️ <see cref="Descrizione"/> è la descrizione <b>di vetrina</b> e <b>non ha alcun
/// fallback</b> sulla descrizione contabile: un prodotto senza scheda di vetrina espone
/// <c>null</c>. Ricadere sull'altra farebbe comparire sul sito una nota interna scritta per la
/// cassa.</para>
///
/// <para><see cref="Prezzo"/> è il prezzo effettivo già risolto dalla regola condivisa — dove
/// <c>0</c> è un omaggio e solo <c>null</c> è assenza — non il prezzo di listino.</para>
///
/// <para><see cref="Id"/> è l'identificativo interno del prodotto. Non è un segreto e non
/// sblocca nulla (non esiste una rotta pubblica per singolo prodotto): serve al consumatore come
/// chiave stabile di rendering.</para>
/// </summary>
public record ProdottoPubblicoDto(
    int Id,
    string Nome,
    string? Descrizione,
    decimal Prezzo,
    string? Allergeni,
    bool Novita,
    bool Consigliato,
    ImmaginePubblicaDto? Immagine);
