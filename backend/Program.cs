using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;

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
using duedgusto.Middleware;
using duedgusto.SeedData;

Env.Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();

// Add services to the container.
builder.Services.AddTransient<PasswordService>();

// ChiusureMensili Services (modello referenziale puro)
builder.Services.AddScoped<ChiusuraMensileService>();
builder.Services.AddScoped<MigrazioneChiusureMensiliService>();

builder.Services.AddSingleton<ISchema, GraphQLSchema>(services => new GraphQLSchema(new SelfActivatingServiceProvider(services)));

// Add GraphQL services for relay types
builder.Services.AddTransient(typeof(ConnectionType<>));
builder.Services.AddTransient(typeof(EdgeType<>));
builder.Services.AddTransient<NodeInterface>();
builder.Services.AddTransient<PageInfoType>();

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    string connectionString = builder.Configuration.GetConnectionString("Default") ?? string.Empty;
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            // Production: Only allow specific domains
            if (!builder.Environment.IsDevelopment())
            {
                return origin == "https://app.duedgusto.com"; // Update with actual production domain
            }

            // Development: Allow localhost and local network IPs
            if (origin.StartsWith("http://localhost:") || origin.StartsWith("https://localhost:"))
            {
                return true;
            }

            // Allow local network IPs (192.168.x.x and 10.x.x.x) on any port
            if (origin.StartsWith("https://192.168.") || origin.StartsWith("http://192.168.") ||
                origin.StartsWith("https://10.") || origin.StartsWith("http://10."))
            {
                return true;
            }

            return false;
        })
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

// SECURITY FIX: Read JWT key from environment variable with fallback to appsettings
string keyString = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
    ?? builder.Configuration.GetSection("Jwt")["Key"]
    ?? throw new InvalidOperationException(
        "JWT_SECRET_KEY environment variable or Jwt:Key configuration must be set. " +
        "Set it with: export JWT_SECRET_KEY='YourSecureRandomKey'"
    );

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
    .ConfigureExecution(async (options, next) =>
    {
        var logger = options.RequestServices!.GetRequiredService<ILogger<Program>>();

        var httpContextAccessor = options.RequestServices!.GetRequiredService<IHttpContextAccessor>();
        var user = httpContextAccessor.HttpContext?.User;
        logger.LogInformation($"User authenticated: {user?.Identity?.IsAuthenticated}");

        options.UnhandledExceptionDelegate = (exception) =>
        {
            logger.LogError("{Error} occurred", exception.OriginalException.Message);
            return Task.CompletedTask;
        };
        var result = await next(options);
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

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
}

app.UseHttpsRedirection();

app.UseCors("AllowSpecificOrigins");

// Rate limiting for authentication endpoints (must be before authentication)
app.UseMiddleware<AuthRateLimitMiddleware>();

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.UseGraphQL<GraphQLSchema>("/graphql", opt =>
{
    opt.AuthorizationRequired = false;
});

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    // Apply pending migrations automatically
    var dbContext = services.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();

    // Seed initial data
    await SeedSuperadmin.Initialize(services);
    await SeedMenus.Initialize(services);
    await SeedCashDenominations.Initialize(services);
    await SeedProducts.Initialize(services);
    await SeedBusinessSettings.Initialize(services);
}

app.Run();
