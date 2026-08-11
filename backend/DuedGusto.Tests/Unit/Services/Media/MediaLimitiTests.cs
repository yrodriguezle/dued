using duedgusto.Services.Media;

namespace DuedGusto.Tests.Unit.Services.Media;

/// <summary>
/// I limiti sono pinnati perché cambiarli sia un <b>gesto deliberato</b> e non una modifica di
/// una riga qualsiasi: vivono in quattro punti diversi (client, nginx, Kestrel/MVC,
/// applicazione) e devono restare in ordine decrescente di permissività dall'esterno verso
/// l'interno. Se questo test diventa rosso, prima di aggiornarlo si aggiornano
/// <c>deploy/nginx/duedgusto.conf</c> e il <c>[RequestSizeLimit]</c> di
/// <c>MediaController</c>, mantenendo il margine per l'overhead del multipart.
/// </summary>
public class MediaLimitiTests
{
    [Fact]
    public void MaxByteFile_Vale20Megabyte()
    {
        MediaLimiti.MaxByteFile.Should().Be(20 * 1024 * 1024);
    }

    [Fact]
    public void LimitiInterni_RestanoPiuStrettiDiQuelliEsterni()
    {
        // nginx 24M > Kestrel/MVC 22 MB > applicazione 20 MB: a rifiutare deve essere sempre
        // lo strato che sa dire perché, mai il web server con un 413 nudo.
        const long limiteKestrel = 22L * 1024 * 1024;
        const long limiteNginx = 24L * 1024 * 1024;

        MediaLimiti.MaxByteFile.Should().BeLessThan(limiteKestrel);
        limiteKestrel.Should().BeLessThan(limiteNginx);
    }

    [Fact]
    public void LarghezzeVarianti_SonoCrescentiENonVuote()
    {
        MediaLimiti.LarghezzeVarianti.Should().Equal(400, 800, 1200, 1600);
        MediaLimiti.LarghezzeVarianti.Should().BeInAscendingOrder();
    }

    [Fact]
    public void MimeAmmessi_SonoLaListaCheIlClientLegge()
    {
        MediaLimiti.MimeAmmessi.Should().BeEquivalentTo("image/jpeg", "image/png", "image/webp");
    }

    [Fact]
    public void SogliaMegapixel_ECoerenteConLeFotocamereInCircolazione()
    {
        // 48 Mpx è il massimo comune sugli smartphone: sotto i 48 la soglia rifiuterebbe foto
        // legittime, molto sopra non proteggerebbe più la memoria del container.
        MediaLimiti.MaxMegapixel.Should().Be(50);
    }
}
