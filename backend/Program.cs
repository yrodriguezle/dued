using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;

using GraphQL;
using GraphQL.Types;
using GraphQL.MicrosoftDI;
using GraphQL.Relay.Types;
using GraphQL.Types.Relay;

using duedgusto.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.Services.Csrf;
using duedgusto.Services.HashPassword;
using duedgusto.Middleware;
using duedgusto.SeedData;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();

// Add services to the container.
builder.Services.AddTransient<PasswordService>();
builder.Services.AddScoped<CsrfTokenGenerator>();

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
    options.AddPolicy("AllowAllDev", policy =>
    {
        policy.AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .SetIsOriginAllowed(origin => true);
    });
});

string keyString = builder.Configuration.GetSection("Jwt")["Key"] ?? string.Empty;
string validIssuer = builder.Configuration["Jwt:Issuer"] ?? string.Empty;
string validAudience = builder.Configuration["Jwt:Audience"] ?? string.Empty;

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

app.UseCors("AllowAllDev");

app.UseAuthentication();

app.UseAuthorization();

// CSRF protection middleware must be after authentication/authorization
app.UseMiddleware<CsrfProtectionMiddleware>();

app.MapControllers();

app.UseGraphQL<GraphQLSchema>("/graphql", opt =>
{
    opt.AuthorizationRequired = false;
});

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    await SeedSuperadmin.Initialize(services);
    await SeedMenus.Initialize(services);
    await SeedCashDenominations.Initialize(services);
    await SeedProducts.Initialize(services);
}

app.Run();
