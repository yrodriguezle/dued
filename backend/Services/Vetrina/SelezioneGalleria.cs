using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services.Media;

namespace duedgusto.Services.Vetrina;

/// <summary>
/// <b>Che cosa è «la galleria»</b>, in un posto solo: i media della cartella dedicata <b>e</b>
/// pubblicati, nell'ordine editoriale.
///
/// <para>🔴 <b>Perché esiste come funzione invece che come tre righe ripetute.</b> Ha due
/// chiamanti — la rotta pubblica <c>/api/public/galleria</c> e il ramo GraphQL di amministrazione
/// che alimenta le schede del pannello — e i due <b>devono</b> vedere la stessa lista, perché
/// <see cref="RuoliImmaginiVetrina"/> assegna i ruoli <i>per posizione dentro questa lista</i>.
/// Due selezioni che differissero anche solo nell'ordinamento farebbero dire alla scheda che una
/// pagina usa una foto mentre il sito ne rende un'altra — senza alcun errore da nessuna parte, che
/// è precisamente la classe di guasto che questa change esiste per togliere.</para>
///
/// <para>⚠️ Il confronto sulla cartella è un'<b>uguaglianza secca</b> sul valore persistito, senza
/// alcuna funzione applicata: la normalizzazione è avvenuta in scrittura, quindi il valore a
/// database è canonico e non soltanto equivalente. Normalizzare qui produrrebbe
/// <c>LOWER(Cartella) = …</c>, non sargabile, e l'indice <c>(Cartella, Ordinamento)</c>
/// smetterebbe di essere utilizzabile per la selezione ordinata. La garanzia è pinnata da
/// <c>QueryDellaGalleria_ConfrontaLaColonnaSenzaApplicarleAlcunaFunzione</c>.</para>
///
/// <para>⚠️ Il secondo criterio d'ordine non è decorativo: <c>Ordinamento</c> non è unico, e senza
/// un discriminante stabile due letture della stessa galleria potrebbero restituire le stesse
/// foto in ordine diverso — cioè <b>ruoli diversi a dati invariati</b>.</para>
/// </summary>
public static class SelezioneGalleria
{
    public static IQueryable<MediaAsset> Righe(AppDbContext dbContext) =>
        dbContext.MediaAssets
            .Where(media => media.Cartella == CartelleVetrina.Galleria && media.Pubblicato)
            .OrderBy(media => media.Ordinamento)
            .ThenBy(media => media.MediaAssetId);
}
