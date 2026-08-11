using duedgusto.Services.Media;

namespace DuedGusto.Tests.Unit.Services.Media;

public class SlugGeneratorTests
{
    [Theory]
    [InlineData("Caffè & Brioche.jpg", "caffe-brioche")]
    [InlineData("foto   del  locale.png", "foto-del-locale")]
    [InlineData("MAIUSCOLE.JPEG", "maiuscole")]
    [InlineData("già-pulito", "gia-pulito")]
    public void Slugifica_NormalizzaAccentiSpaziEMaiuscole(string nome, string atteso)
    {
        SlugGenerator.Slugifica(nome).Should().Be(atteso);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("@@@ ###.jpg")]
    [InlineData(null)]
    public void Slugifica_SenzaNullaDiUtilizzabile_RicadeSuMedia(string? nome)
    {
        // Uno slug vuoto produrrebbe una chiave fatta del solo suffisso: illeggibile per
        // chiunque guardi il filesystem.
        SlugGenerator.Slugifica(nome).Should().Be("media");
    }

    [Fact]
    public void Slugifica_TroncaASessantaCaratteriSenzaLasciareSeparatoriPendenti()
    {
        string lungo = new string('a', 40) + " " + new string('b', 40);

        string slug = SlugGenerator.Slugifica(lungo);

        slug.Length.Should().BeLessThanOrEqualTo(SlugGenerator.LunghezzaMassima);
        slug.Should().NotEndWith("-");
    }

    /// <summary>
    /// 🔴 Il nome del file arriva dal client, e <c>"../../etc/passwd.jpg"</c> è un nome
    /// perfettamente legittimo per un browser. La difesa non è un elenco di caratteri vietati
    /// da tenere aggiornato: è un elenco di caratteri <b>ammessi</b>.
    /// </summary>
    [Theory]
    [InlineData("../../etc/passwd.jpg")]
    [InlineData("..\\..\\windows\\system32\\config\\sam.png")]
    [InlineData("/etc/shadow")]
    [InlineData("....//....//tmp/x.jpg")]
    public void Slugifica_NomeOstile_NonEsceMaiDallaRadice(string nomeOstile)
    {
        string slug = SlugGenerator.Slugifica(nomeOstile);

        slug.Should().NotContain("/");
        slug.Should().NotContain("\\");
        slug.Should().NotContain("..");
    }

    [Fact]
    public void CreaChiave_HaLaFormaAnnoMeseSlugSuffisso()
    {
        string chiave = SlugGenerator.CreaChiave("Foto Locale.jpg", new DateTime(2026, 8, 11));

        chiave.Should().MatchRegex(@"^2026/08/foto-locale-[23456789abcdefghijkmnopqrstuvwxyz]{6}$");
    }

    [Fact]
    public void CreaChiave_DueVolteLoStessoNome_DaChiaviDiverse()
    {
        // Due upload dello stesso menu.jpg non devono sovrascriversi, e nessuno deve poter
        // indovinare l'indirizzo di un'immagine caricata da altri.
        var istante = new DateTime(2026, 8, 11);

        string prima = SlugGenerator.CreaChiave("menu.jpg", istante);
        string seconda = SlugGenerator.CreaChiave("menu.jpg", istante);

        prima.Should().NotBe(seconda);
    }

    [Fact]
    public void Suffisso_NonUsaCaratteriAmbigui()
    {
        // Le chiavi finiscono dentro indirizzi che qualcuno prima o poi leggerà ad alta voce.
        string insieme = string.Concat(Enumerable.Range(0, 200).Select(_ => SlugGenerator.Suffisso()));

        insieme.Should().NotContain("0");
        insieme.Should().NotContain("O");
        insieme.Should().NotContain("1");
        insieme.Should().NotContain("l");
        insieme.Should().NotContain("I");
    }
}
