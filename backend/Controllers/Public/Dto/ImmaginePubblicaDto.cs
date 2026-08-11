namespace duedgusto.Controllers.Public.Dto;

/// <summary>
/// La forma di un'immagine nell'API pubblica — <b>una sola per tutta la superficie</b>,
/// condivisa da <c>/api/public/menu</c> e <c>/api/public/galleria</c>, così che il consumatore
/// abbia un tipo solo da gestire e un solo componente da scrivere.
///
/// <para>🔴 <b>La chiave, non l'URL.</b> Nessuno schema <c>http</c>, nessun host, nessun
/// prefisso <c>/media</c>: la chiave non conosce l'ambiente, il prefisso è <i>serving</i> e non
/// dato. Una risposta cacheata 300 secondi che contenesse un hostname resterebbe sbagliata per
/// cinque minuti dopo qualunque cambio di dominio o di reverse proxy.</para>
///
/// <para>⚠️ Chi compone l'URL è il consumatore, e ha <b>due</b> prefissi distinti: quello con cui
/// legge le rotte API server-side (rete interna) e quello con cui il <b>browser</b> carica le
/// immagini. Confonderli produce markup che funziona in ogni prova server-side e si rompe per
/// ogni visitatore — in sviluppo i due prefissi coincidono, ed è precisamente per questo che
/// l'errore non si vede finché non si va in produzione.</para>
///
/// <para><see cref="Larghezza"/> e <see cref="Altezza"/> esistono perché il consumatore possa
/// dichiararle nel markup e azzerare lo spostamento del contenuto durante il caricamento;
/// <see cref="Focale"/> è già nella forma di destinazione (<c>object-position</c>) e non una
/// coppia di numeri da ricomporre.</para>
/// </summary>
public record ImmaginePubblicaDto(
    string Chiave,
    IReadOnlyList<int> LarghezzeDisponibili,
    int Larghezza,
    int Altezza,
    string? TestoAlternativo,
    string? Didascalia,
    string? Focale,
    string? Placeholder);
