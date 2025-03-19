using System.Text;
using System.Diagnostics;

using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;

using GraphQL;
using GraphQL.MicrosoftDI;

using duedgusto.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.Services.HashPassword;
using duedgusto.SeedData;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();

// Add services to the container.
builder.Services.AddTransient<IJwtService, JwtService>();
builder.Services.AddTransient<PasswordService>();

builder.Services.AddSingleton(services => new GraphQLSchema(new SelfActivatingServiceProvider(services)));
builder.Services.AddSingleton<GraphQLQueries>();

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(options => {
    string connectionString = builder.Configuration.GetConnectionString("Default") ?? string.Empty;
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));
});

byte[] key = Encoding.UTF8.GetBytes(builder.Configuration.GetSection("Jwt")["Key"] ?? string.Empty);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"]
        };
    });

// GraphQl
builder.Services.AddGraphQL((ctx) => ctx
    .AddSchema<GraphQLSchema>()
    .AddAutoClrMappings()
    .ConfigureExecution(async (options, next) =>
    {
        var logger = options.RequestServices!.GetRequiredService<ILogger<Program>>();
        options.UnhandledExceptionDelegate = (exception) => {
            logger.LogError("{Error} occurred", exception.OriginalException.Message);
            return Task.CompletedTask;
        };

        var timer = Stopwatch.StartNew();
        var result = await next(options);
        result.Extensions ??= [];
        result.Extensions["elapsedMs"] = timer.ElapsedMilliseconds;
        return result;
    })
    .AddSystemTextJson()
    .AddDataLoader()
    .AddAuthorizationRule()
    .AddUserContextBuilder(context => new GraphQLUserContext(context.User.Identity?.IsAuthenticated == true ? context.User : null))
    .UseApolloTracing(_ => builder.Environment.IsDevelopment())
    .AddGraphTypes(typeof(GraphQLSchema).Assembly));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
}

app.UseHttpsRedirection();

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
    await SeedData.Initialize(services);
}

app.Run();
