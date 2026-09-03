namespace duedgusto.Controllers.Public.Dto;

/// <summary>
/// La galleria pubblica: i media della cartella dedicata e pubblicati, nell'ordine editoriale.
///
/// <para>Un elenco <b>vuoto è uno stato legittimo</b> — nessuno ha ancora etichettato immagini —
/// e produce <c>200</c>, non un errore. La diagnosi di quello stato vive in amministrazione,
/// dove la libreria mostra la cartella di ogni media.</para>
///
/// <para><c>IReadOnlyList&lt;T&gt;</c> e non <c>T[]</c> (mutabile) né
/// <c>IEnumerable&lt;T&gt;</c> (senza un <c>Count</c> deterministico da serializzare).</para>
/// </summary>
/// <param name="Immagini">
/// L'elenco completo, nell'ordine editoriale. <b>Resta</b>, e resta il contratto che era: la
/// spec <c>api-pubblica</c> lo pinna in quattro scenari e i test del sito lo leggono. Il campo
/// accanto è <b>additivo per definizione</b>.
/// </param>
/// <param name="Ruoli">
/// 🔴 Chi ricopre quale ruolo su quale pagina — <b>già risolto dal server</b>.
///
/// <para>È la ragione per cui questo campo esiste: fino a questo change le quattro pagine
/// indicizzavano <see cref="Immagini"/> ciascuna con i propri offset
/// (<c>galleria[0]</c>, <c>slice(0,3)</c>, <c>galleria[1] ?? galleria[0]</c>,
/// <c>slice(2,5)</c>, <c>at(-1)</c>), cioè la stessa regola scritta quattro volte in quattro
/// file e in nessun posto interrogabile. Ora la regola vive in
/// <c>Services/Vetrina/RuoliImmaginiVetrina.cs</c> e il consumatore <b>legge un nome</b>.</para>
///
/// <para>⚠️ Le immagini dei ruoli sono le <b>stesse</b> che compaiono in <see cref="Immagini"/>,
/// ripetute. La duplicazione nel payload costa qualche centinaio di byte su una risposta
/// cacheata 300 s e risparmia al consumatore una <c>join</c> per chiave dentro ogni pagina —
/// cioè logica, proprio dove la si sta togliendo. Esprimere i ruoli come <b>indici</b> sarebbe
/// stato peggio ancora: gli indici sono ciò che questo change esiste per abolire.</para>
///
/// <para>⚠️ Non esce <c>origine</c> (scelta esplicita o ripiego posizionale): serve alla scheda
/// del pannello per dire <i>«scelta da te»</i> invece di <i>«è la prima della galleria, e
/// cambierà»</i>, e il sito non ha nulla da farci. Vive sul ramo GraphQL di amministrazione.</para>
/// </param>
public record GalleriaPubblicaDto(
    IReadOnlyList<ImmaginePubblicaDto> Immagini,
    RuoliImmaginiDto Ruoli);

/// <summary>
/// Il piano dei ruoli, nella forma che il sito consuma: <b>immagini complete</b>, una property
/// per ruolo, nessun indice.
///
/// <para>🔴 <b>Un ruolo singolo vuoto è uno stato legittimo e frequente</b>, non un guasto: con
/// la galleria vuota lo sono tutti, e <see cref="EroeAperitivo"/> e <see cref="EroePiatto"/> lo
/// sono anche a galleria piena finché l'amministratore non sceglie — quei due ruoli <b>non hanno
/// ripiego posizionale</b>. Il consumatore che riceve <c>null</c> non rende la sezione, che è la
/// regola già in vigore su tutto il resto del sito.</para>
///
/// <para>⚠️ Le tre griglie sono liste, <b>mai <c>null</c></b>, e possono avere meno di tre
/// elementi (o zero) quando la galleria è corta: il numero di foto è un fatto della galleria, non
/// una promessa del contratto.</para>
///
/// <para>Riusa <see cref="ImmaginePubblicaDto"/> — la forma unica di tutta la superficie
/// pubblica — quindi il consumatore non ha un secondo tipo da gestire, e la visita ricorsiva di
/// <c>SuperficiePubblicaTests</c> attraversa questo record senza sapere che esiste.</para>
/// </summary>
public record RuoliImmaginiDto(
    ImmaginePubblicaDto? EroeHome,
    IReadOnlyList<ImmaginePubblicaDto> GrigliaHome,
    IReadOnlyList<ImmaginePubblicaDto> FotoMenu,
    ImmaginePubblicaDto? RitrattoLocale,
    IReadOnlyList<ImmaginePubblicaDto> QuadrateLocale,
    ImmaginePubblicaDto? EroeAperitivo,
    ImmaginePubblicaDto? EroePiatto);
