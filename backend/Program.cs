using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;

using GraphQL;
using GraphQL.Types;
using GraphQL.MicrosoftDI;
using GraphQL.Relay.Types;
using GraphQL.Types.Relay;

using DotNetEnv;

using duedgusto.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.Services.HashPassword;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;
using duedgusto.Middleware;
using duedgusto.SeedData;
using duedgusto.Repositories.Interfaces;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Implementations.Domain;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Fornitori;

using GraphQL.Server.Transports.AspNetCore.WebSockets;
using System.Net;
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
builder.Services.AddScoped<MigrazioneChiusureMensiliService>();

// Fornitori Services
builder.Services.AddScoped<RegistroCassaSyncService>();

// Fornitori Orchestrators
builder.Services.AddScoped<FornitoreOrchestrator>();
builder.Services.AddScoped<FatturaAcquistoOrchestrator>();
builder.Services.AddScoped<DocumentoTrasportoService>();
builder.Services.AddScoped<PagamentoFornitoreOrchestrator>();

// GestioneCassa Orchestrators
builder.Services.AddScoped<MutateRegistroCassaOrchestrator>();
builder.Services.AddScoped<ChiudiRegistroCassaOrchestrator>();
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
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
});

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

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (Uri.TryCreate(origin, UriKind.Absolute, out Uri? uri))
            {
                var host = uri.Host;

                // Allow localhost
                if (host == "localhost" || host == "127.0.0.1")
                    return true;

                // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
                if (System.Net.IPAddress.TryParse(host, out IPAddress? ip))
                {
                    var bytes = ip.GetAddressBytes();
                    if (bytes.Length == 4)
                    {
                        // 192.168.x.x
                        if (bytes[0] == 192 && bytes[1] == 168) return true;
                        // 10.x.x.x
                        if (bytes[0] == 10) return true;
                        // 172.16.0.0 - 172.31.255.255
                        if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
                    }

                    // Production: allow public IP access (served via Nginx on same IP)
                    return true;
                }

                // Allow configured domain (e.g. app.duedgusto.com)
                if (host == "app.duedgusto.com") return true;
            }

            return false;
        })
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
        await SeedCashDenominations.Initialize(services);
        await SeedProducts.Initialize(services);
        await SeedBusinessSettings.Initialize(services);
    }

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
