using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// <see cref="IWebHostEnvironment"/> minimo per i test.
///
/// <para>Serve a chi costruisce componenti che decidono in base all'ambiente — oggi
/// <c>NoIntrospectionValidationRule</c>, che valuta <c>IsDevelopment()</c> nel costruttore.
/// Il default è <c>Production</c>: l'ambiente in cui i controlli di sicurezza sono attivi è
/// quello che i test devono esercitare per difetto, non quello permissivo.</para>
/// </summary>
public sealed class FakeWebHostEnvironment : IWebHostEnvironment
{
    public string EnvironmentName { get; set; } = "Production";
    public string ApplicationName { get; set; } = "duedgusto";
    public string WebRootPath { get; set; } = string.Empty;
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = string.Empty;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
