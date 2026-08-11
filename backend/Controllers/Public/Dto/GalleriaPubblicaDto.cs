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
public record GalleriaPubblicaDto(IReadOnlyList<ImmaginePubblicaDto> Immagini);
