using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

using GraphQL;
using GraphQL.Types;
using GraphQL.MicrosoftDI;
using GraphQL.Relay.Types;
using GraphQL.Types.Relay;

using DotNetEnv;

using duedgusto.Common;
using duedgusto.GraphQL;
using duedgusto.GraphQL.Validation;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.Services.HashPassword;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;
using duedgusto.Services.Media;
using duedgusto.Middleware;
using duedgusto.SeedData;
using duedgusto.Repositories.Interfaces;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Implementations.Domain;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Fornitori;

using GraphQL.Server.Transports.AspNetCore.WebSockets;
using System.Security.Claims;
using duedgusto.Models;

Env.Load();

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();

// Add services to the container.
builder.Services.AddTransient<PasswordService>();

// ChiusureMensili Services (modello referenziale puro)
builder.Services.AddScoped<ChiusuraMensileValidator>();
builder.Services.AddScoped<ChiusuraMensileService>();

// Fornitori Services
builder.Services.AddScoped<RegistroCassaSyncService>();
builder.Services.AddScoped<DocumentiFornitoreService>();

// Fornitori Orchestrators
builder.Services.AddScoped<FornitoreOrchestrator>();
builder.Services.AddScoped<FatturaAcquistoOrchestrator>();
builder.Services.AddScoped<DocumentoTrasportoService>();
builder.Services.AddScoped<PagamentoFornitoreOrchestrator>();

// GestioneCassa Orchestrators
builder.Services.AddScoped<MutateRegistroCassaOrchestrator>();
builder.Services.AddScoped<MutateSpesaCassaOrchestrator>();
builder.Services.AddScoped<ChiudiRegistroCassaOrchestrator>();
builder.Services.AddScoped<RiapriRegistroCassaOrchestrator>();
builder.Services.AddScoped<EliminaRegistroCassaOrchestrator>();

// Event Bus per GraphQL Subscriptions
builder.Services.AddSingleton<IEventBus, EventBus>();
builder.Services.AddTransient<IWebSocketAuthenticationService, duedgusto.Services.WebSocket.WebSocketAuthenticationService>();

builder.Services.AddSingleton<ISchema, GraphQLSchema>(services => new GraphQLSchema(new SelfActivatingServiceProvider(services)));

// Add GraphQL services for relay types
builder.Services.AddTransient(typeof(ConnectionType<>));
builder.Services.AddTransient(typeof(EdgeType<>));
builder.Services.AddTransient<NodeInterface>();
builder.Services.AddTransient<PageInfoType>();

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    // Catena di risoluzione: env var → configuration → fallback SOLO in Development (fail-fast altrove)
    string connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")
        ?? builder.Configuration.GetConnectionString("Default")
        ?? (builder.Environment.IsDevelopment()
            ? "server=localhost;database=duedgusto;user=root;password=root"
            : throw new InvalidOperationException(
                "CONNECTION_STRING non impostata. In ambienti non-Development impostare la variabile " +
                "d'ambiente CONNECTION_STRING (oppure ConnectionStrings__Default)."));
    // A runtime: rileva la versione MySQL dal server (AutoDetect apre una connessione).
    // A design-time (dotnet ef migrations add/update con EF_MIGRATIONS=1): usa una versione
    // fissa per non richiedere un DB in esecuzione. Il comportamento runtime resta invariato.
    ServerVersion serverVersion = Environment.GetEnvironmentVariable("EF_MIGRATIONS") == "1"
        ? new MySqlServerVersion(new Version(8, 0, 32))
        : ServerVersion.AutoDetect(connectionString);
    options.UseMySql(connectionString, serverVersion);
});

// ── Media ────────────────────────────────────────────────────────────────────────────────
// Radice dei binari, stessa catena fail-fast di CONNECTION_STRING: il default vale SOLO in
// Development. In produzione una radice indovinata significherebbe scrivere i media dentro
// il container, dove sopravvivono fino alla prima ricreazione — e accorgersene mesi dopo,
// con il database pieno di riferimenti a file che non esistono più.
string mediaRoot = Environment.GetEnvironmentVariable("MEDIA_ROOT")
    ?? (builder.Environment.IsDevelopment()
        ? Path.Combine(builder.Environment.ContentRootPath, "media")
        : throw new InvalidOperationException(
            "MEDIA_ROOT non impostata. In ambienti non-Development impostare la variabile " +
            "d'ambiente MEDIA_ROOT (in Docker: /app/media, bind mount di /opt/duedgusto/media)."));
builder.Services.AddSingleton(new MediaRoot(mediaRoot));

// Tetto duro sull'allocatore di ImageSharp: limita il danno di UN file patologico.
// È metà del doppio freno alla memoria — l'altra metà è il SemaphoreSlim(2) di
// ImmagineProcessor, che limita quanti file si elaborano insieme. L'allocatore limita
// l'AMPIEZZA, il semaforo la CONCORRENZA: nessuno dei due sostituisce l'altro.
// ⚠️ ImageSharp 3.x non espone un limite cumulativo di allocazione: l'unico tetto disponibile
//    è quello sul singolo buffer. Il totale vivo resta governato dal semaforo.
SixLabors.ImageSharp.Configuration.Default.MemoryAllocator =
    SixLabors.ImageSharp.Memory.MemoryAllocator.Create(
        new SixLabors.ImageSharp.Memory.MemoryAllocatorOptions { AllocationLimitMegabytes = 128 });

builder.Services.AddScoped<IMediaStorage, FileSystemMediaStorage>();
builder.Services.AddScoped<ImmagineProcessor>();

// Repository Pattern — UnitOfWork + Domain Repositories
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IRegistroCassaRepository, RegistroCassaRepository>();
builder.Services.AddScoped<IFornitoreRepository, FornitoreRepository>();
builder.Services.AddScoped<IFatturaAcquistoRepository, FatturaAcquistoRepository>();
builder.Services.AddScoped<IDocumentoTrasportoRepository, DocumentoTrasportoRepository>();
builder.Services.AddScoped<IPagamentoFornitoreRepository, PagamentoFornitoreRepository>();
builder.Services.AddScoped<IVenditaRepository, VenditaRepository>();
builder.Services.AddScoped<IProdottoRepository, ProdottoRepository>();
builder.Services.AddScoped<IUtenteRepository, UtenteRepository>();
builder.Services.AddScoped<IChiusuraMensileRepository, ChiusuraMensileRepository>();
builder.Services.AddScoped<IRuoloRepository, RuoloRepository>();
builder.Services.AddScoped<IMenuRepository, MenuRepository>();
builder.Services.AddScoped<IBusinessSettingsRepository, BusinessSettingsRepository>();

// SECURITY: host esterni autorizzati, oltre a localhost e alla LAN privata.
// Lista separata da virgole in ALLOWED_ORIGINS (solo host, senza schema né porta);
// SERVER_IP, se impostata, viene aggiunta automaticamente.
//
// In produzione nginx serve frontend e API sullo STESSO origin, quindi il CORS non
// entra quasi mai in gioco: conta per lo sviluppo (Vite su :4001 → backend su :4000)
// e per l'accesso da app.duedgusto.com, che punta all'API sull'IP del VPS.
// Il verdetto sulla singola origine vive in CorsOriginPolicy: è un controllo di sicurezza,
// e come lambda inline qui sarebbe irraggiungibile dai test.
HashSet<string> allowedOrigins = CorsOriginPolicy.CostruisciAllowlist(
    Environment.GetEnvironmentVariable("ALLOWED_ORIGINS"),
    Environment.GetEnvironmentVariable("SERVER_IP"));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        policy.SetIsOriginAllowed(origin => CorsOriginPolicy.OrigineAmmessa(origin, allowedOrigins))
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

// SECURITY: JWT key da env var → configuration → fallback dev (dichiaratamente insicura)
// SOLO in Development; in ogni altro ambiente l'avvio fallisce se la variabile manca.
string keyString = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
    ?? builder.Configuration.GetSection("Jwt")["Key"]
    ?? (builder.Environment.IsDevelopment()
        ? "dev-only-insecure-jwt-key-do-not-use-in-production-2026"
        : throw new InvalidOperationException(
            "JWT_SECRET_KEY non impostata. In ambienti non-Development impostare la variabile " +
            "d'ambiente JWT_SECRET_KEY (es. generata con: openssl rand -base64 32)."));

string validIssuer = builder.Configuration["Jwt:Issuer"] ?? "duedgusto-api";
string validAudience = builder.Configuration["Jwt:Audience"] ?? "duedgusto-clients";

var jwtHelper = new JwtHelper(keyString, SecurityKeyType.SymmetricSecurityKey);
builder.Services.AddSingleton(jwtHelper);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts => opts.TokenValidationParameters = jwtHelper.TokenValidationParameters);

// GraphQl
builder.Services.AddGraphQL((ctx) => ctx
    .AddSchema<GraphQLSchema>()
    .AddAutoClrMappings()
    // Introspezione consentita solo in Development: la rule decide da sé in base
    // all'ambiente, così la catena resta una sola per tutti gli ambienti.
    .AddValidationRule<NoIntrospectionValidationRule>()
    .AddErrorInfoProvider(opt =>
    {
        // Dettagli eccezioni esposti al client SOLO in Development
        opt.ExposeExceptionDetails = builder.Environment.IsDevelopment();
        opt.ExposeData = builder.Environment.IsDevelopment();
        opt.ExposeExtensions = builder.Environment.IsDevelopment();
    })
    .ConfigureExecution(async (options, next) =>
    {
        ILogger<Program> logger = options.RequestServices!.GetRequiredService<ILogger<Program>>();
        IWebHostEnvironment env = options.RequestServices!.GetRequiredService<IWebHostEnvironment>();

        IHttpContextAccessor httpContextAccessor = options.RequestServices!.GetRequiredService<IHttpContextAccessor>();
        ClaimsPrincipal? user = httpContextAccessor.HttpContext?.User;
        logger.LogInformation($"User authenticated: {user?.Identity?.IsAuthenticated}");

        options.UnhandledExceptionDelegate = (exception) =>
        {
            // Logging server-side SEMPRE attivo, in tutti gli ambienti
            logger.LogError(exception.OriginalException,
                "GraphQL unhandled exception in field '{FieldName}': {Error}",
                exception.FieldContext?.FieldAst?.Name,
                exception.OriginalException.Message);

            // Dettagli eccezione (tipo, inner, stack trace) nella risposta SOLO in Development;
            // in produzione il client riceve il messaggio generico dell'ErrorInfoProvider.
            // Gli ExecutionError di business non passano da qui e arrivano invariati al client.
            if (env.IsDevelopment())
            {
                Exception ex = exception.OriginalException;
                var details = $"{ex.GetType().Name}: {ex.Message}";
                if (ex.InnerException != null)
                    details += $"\n--- Inner: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}";
                if (ex.InnerException?.InnerException != null)
                    details += $"\n--- Inner.Inner: {ex.InnerException.InnerException.GetType().Name}: {ex.InnerException.InnerException.Message}";
                details += $"\n--- StackTrace: {ex.StackTrace}";
                exception.ErrorMessage = details;
            }

            return Task.CompletedTask;
        };
        ExecutionResult result = await next(options);
        return result;
    })
    .AddSystemTextJson()
    .AddDataLoader()
    .AddAuthorizationRule()
    .AddUserContextBuilder(context =>
    {
        var result = new GraphQLUserContext(context.User.Identity?.IsAuthenticated == true ? context.User : null);
        return result;
    })
    .AddGraphTypes(typeof(GraphQLSchema).Assembly));

WebApplication app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowSpecificOrigins");

// Rate limiting for authentication endpoints (must be before authentication)
app.UseMiddleware<AuthRateLimitMiddleware>();

app.UseAuthentication();

app.UseAuthorization();

// ── Media statici: SOLO in Development ───────────────────────────────────────────────────
// In produzione i media li serve nginx (location /media/), che ha sendfile e non paga la
// pipeline dei middleware su ogni thumbnail. L'URL però è identica nei due ambienti senza
// alcun "if" nel client, perché API_ENDPOINT punta già, in entrambi, all'host che serve
// /media/: la chiave nel database non conosce l'ambiente ed è portabile fra i due.
if (app.Environment.IsDevelopment())
{
    Directory.CreateDirectory(mediaRoot);

    // .webp esplicito: se il provider di default non lo mappasse, con ServeUnknownFileTypes
    // a false ogni variante WebP darebbe un 404 muto in sviluppo, e sembrerebbe un bug della
    // pipeline immagini invece che del content-type.
    var mediaContentTypes = new FileExtensionContentTypeProvider();
    mediaContentTypes.Mappings[".webp"] = "image/webp";

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(mediaRoot),
        RequestPath = "/media",
        ContentTypeProvider = mediaContentTypes,
        ServeUnknownFileTypes = false,
        // Cache aggressiva sicura: ogni chiave contiene un suffisso casuale e i file non
        // vengono mai sovrascritti — "sostituire l'immagine" è un nuovo upload, nuova chiave.
        OnPrepareResponse = ctx =>
            ctx.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable",
    });
}

app.MapControllers();

app.UseWebSockets();

app.UseGraphQL<GraphQLSchema>("/graphql", opt =>
{
    opt.AuthorizationRequired = false;
});

using (IServiceScope scope = app.Services.CreateScope())
{
    IServiceProvider services = scope.ServiceProvider;

    // Apply pending migrations automatically
    AppDbContext dbContext = services.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();

    // SeedSuperadmin always runs (needed for first boot, has its own Any() check)
    await SeedSuperadmin.Initialize(services);

    var seedOnStartup = Environment.GetEnvironmentVariable("SEED_ON_STARTUP")?.ToLower() != "false";
    if (seedOnStartup)
    {
        await SeedMenus.Initialize(services);
        // Dopo SeedMenus: la sezione "Sito" riusa i ruoli amministrativi che quel seed
        // ha già creato/aggiornato, e si aggancia in coda alle voci esistenti (Posizione 9).
        await SeedMenusSito.Initialize(services);
        await SeedCashDenominations.Initialize(services);
        await SeedBusinessSettings.Initialize(services);
    }

    // Import una-tantum dello storico chiusure 2026 dal foglio Excel: OFF per default,
    // si abilita con SEED_REGISTRI_STORICI=dryrun|1. Salta le date già presenti.
    // Deve girare dopo denominazioni e BusinessSettings, che usa entrambi.
    await SeedRegistriCassaStorici.Initialize(services);

    // Data-fix idempotente: riallinea TotaleVendite (e breakdown IVA) dei registri
    // esistenti alla formula del KPI giornaliero. No-op quando tutto è già allineato.
    await SeedRicalcoloTotaleVendite.Initialize(services);

    // Rettifica gestionale una-tantum (issue #6) del residuo IVA stimato: OFF per default,
    // si abilita con RICALCOLO_IVA_STIMA=dryrun|1. Vedi SeedRicalcoloIvaVenditeStima.
    await SeedRicalcoloIvaVenditeStima.Initialize(services);

    // Utente test e2e — solo in Development
    if (app.Environment.IsDevelopment())
    {
        await SeedTestUser.Initialize(services);
    }
}

var appVersion = Assembly.GetEntryAssembly()?
    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
    .InformationalVersion
    ?? Assembly.GetEntryAssembly()?.GetName().Version?.ToString()
    ?? "unknown";

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow, version = appVersion }));

app.MapGet("/version", () => Results.Ok(new { version = appVersion }));

app.MapGet("/api/public/business-name", async (AppDbContext dbContext) =>
{
    BusinessSettings? settings = await dbContext.BusinessSettings.FirstOrDefaultAsync();
    return Results.Ok(new { businessName = settings?.BusinessName ?? "DuedGusto" });
});

app.Run();
