using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

using duedgusto.Common;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Models;

namespace DuedGusto.Tests.Unit.GraphQL;

/// <summary>
/// I tre pulsanti del punto vendita e i tre secchi del registro (issue #19, Fase 4).
///
/// <para>Il test che conta di più è quello sul <b>contante non tracciato</b>: deve lasciare il
/// registro identico. Se un giorno qualcuno «sistemasse» quel ramo facendogli scrivere un
/// campo, il contante finirebbe contato due volte — una nel cassetto, una nel secchio — e la
/// quadratura del foglio direbbe il falso senza che nulla fallisca.</para>
/// </summary>
public class SecchiIncassiApplierTests
{
    private static readonly ILogger Logger = NullLogger.Instance;

    private static RegistroCassa Registro(decimal elettronici = 0m, decimal contanteTracciato = 0m) =>
        new()
        {
            Id = 42,
            TotaleApertura = 100m,
            TotaleChiusura = 350m,
            IncassiElettronici = elettronici,
            IncassoContanteTracciato = contanteTracciato,
        };

    [Fact]
    public void Elettronico_FinisceNegliIncassiElettronici()
    {
        RegistroCassa registro = Registro();

        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.Elettronico, 2.50m, Logger);

        registro.IncassiElettronici.Should().Be(2.50m);
        registro.IncassoContanteTracciato.Should().Be(0m);
    }

    [Fact]
    public void ContanteTracciato_FinisceNelContanteDichiarato()
    {
        RegistroCassa registro = Registro();

        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.ContanteTracciato, 2.50m, Logger);

        registro.IncassoContanteTracciato.Should().Be(2.50m);
        registro.IncassiElettronici.Should().Be(0m);
    }

    [Fact]
    public void ContanteNonTracciato_NonToccaNulla()
    {
        // 🔴 Il contante si conta una volta sola, contandolo: è già dentro Chiusura − Apertura,
        //    e il non tracciato è il residuo Ecc calcolato per differenza. Scriverlo da qualche
        //    parte lo conterebbe due volte.
        RegistroCassa registro = Registro(elettronici: 30m, contanteTracciato: 70m);

        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.ContanteNonTracciato, 2.50m, Logger);

        registro.IncassiElettronici.Should().Be(30m);
        registro.IncassoContanteTracciato.Should().Be(70m);
    }

    [Fact]
    public void DeltaNegativo_Sottrae()
    {
        RegistroCassa registro = Registro(elettronici: 30m);

        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.Elettronico, -10m, Logger);

        registro.IncassiElettronici.Should().Be(20m);
    }

    [Fact]
    public void CambioDiMetodo_SpostaLImportoDaUnSecchioAllAltro()
    {
        // La correzione più probabile al bancone: «l'ho battuto elettronico ma ha pagato in
        // contanti». Si toglie dal vecchio e si mette nel nuovo, in due colpi.
        RegistroCassa registro = Registro(elettronici: 12m);

        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.Elettronico, -12m, Logger);
        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.ContanteTracciato, 12m, Logger);

        registro.IncassiElettronici.Should().Be(0m);
        registro.IncassoContanteTracciato.Should().Be(12m);
    }

    [Fact]
    public void SecchioCheAndrebbeSottoZero_VienePortatoAZeroSenzaEccezioni()
    {
        // Succede togliendo una vendita dopo che qualcuno ha abbassato a mano il totale
        // digitato. Un incasso POS di −5 € non significa niente, e la cassa non si blocca mai.
        RegistroCassa registro = Registro(elettronici: 3m);

        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.Elettronico, -8m, Logger);

        registro.IncassiElettronici.Should().Be(0m);
    }

    [Fact]
    public void MetodoSconosciuto_NonToccaNullaEnonEsplode()
    {
        RegistroCassa registro = Registro(elettronici: 30m, contanteTracciato: 70m);

        Action azione = () => SecchiIncassiApplier.ApplicaDelta(registro, "ASSEGNO", 5m, Logger);

        azione.Should().NotThrow();
        registro.IncassiElettronici.Should().Be(30m);
        registro.IncassoContanteTracciato.Should().Be(70m);
    }

    [Fact]
    public void ImportoZero_ELDelta_NonFaNulla()
    {
        RegistroCassa registro = Registro(elettronici: 30m);

        SecchiIncassiApplier.ApplicaDelta(registro, MetodiPagamentoVendita.Elettronico, 0m, Logger);

        registro.IncassiElettronici.Should().Be(30m);
    }

    [Fact]
    public void IMetodiAmmessiSonoEsattamenteTre()
    {
        // Pinna l'insieme chiuso: aggiungerne uno senza decidere in quale secchio finisce
        // lo farebbe cadere nel ramo «sconosciuto», cioè in nessun incasso, in silenzio.
        MetodiPagamentoVendita.Ammessi.Should().BeEquivalentTo(
        [
            MetodiPagamentoVendita.Elettronico,
            MetodiPagamentoVendita.ContanteTracciato,
            MetodiPagamentoVendita.ContanteNonTracciato,
        ]);

        MetodiPagamentoVendita.IsAmmesso("ASSEGNO").Should().BeFalse();
        MetodiPagamentoVendita.IsAmmesso(null).Should().BeFalse();
        MetodiPagamentoVendita.IsAmmesso("elettronico").Should().BeFalse("il confronto è ordinale, non case-insensitive");
    }
}
