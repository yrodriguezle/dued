using System.Security.Claims;
using System.Security.Cryptography;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.Services.HashPassword;

namespace duedgusto.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class AuthController(AppDbContext dbContext, JwtHelper jwtHelper, IWebHostEnvironment env) : ControllerBase
{
    [HttpPost("signin"), AllowAnonymous]
    public async Task<IActionResult> SignIn([FromBody] SignInRequest request)
    {
        // SECURITY FIX: Prevent timing attacks and account enumeration
        // Always perform password hashing even if user doesn't exist to normalize response time

        // Dummy values for non-existent users
        byte[] dummyHash = new byte[32];
        byte[] dummySalt = new byte[32];
        RandomNumberGenerator.Fill(dummyHash);
        RandomNumberGenerator.Fill(dummySalt);

        Utente? user = await dbContext.Utenti.FirstOrDefaultAsync(x => x.NomeUtente == request.Username);

        bool isValid;
        if (user == null)
        {
            // Perform dummy password verification to match timing of real verification
            PasswordService.VerifyPassword(request.Password, dummyHash, dummySalt);
            isValid = false;
        }
        else
        {
            // Verify actual password
            isValid = PasswordService.VerifyPassword(request.Password, user.Hash, user.Salt);
        }

        // Add random delay (50-200ms) to further obscure timing differences
        await Task.Delay(Random.Shared.Next(50, 200));

        if (!isValid)
        {
            return Unauthorized(new { message = "Credenziali non valide" });
        }

        // SECURITY FIX: Check if account is disabled
        if (user!.Disabilitato == true)
        {
            return Unauthorized(new { message = "Account disabilitato. Contatta l'amministratore." });
        }

        Claim[] claims = [
            new Claim(ClaimTypes.Name, user.NomeUtente),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("UserId", user.Id.ToString()),
        ];

        (string RefreshToken, string Token) = jwtHelper.CreateSignedToken(claims);
        user.TokenAggiornamento = RefreshToken;
        // SECURITY FIX: Add server-side expiration for refresh token
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);

        await dbContext.SaveChangesAsync();
        return Ok(new { Token, RefreshToken  });
    }

    [HttpPost("refresh"), AllowAnonymous]
    public async Task<IActionResult> RefreshToken([FromBody] TokenResponse request)
    {
        Utente? user = await dbContext.Utenti.FirstOrDefaultAsync(u => u.TokenAggiornamento == request.RefreshToken);

        if (user == null)
        {
            return Unauthorized(new { message = "Invalid or expired refresh token" });
        }

        // SECURITY FIX: Validate refresh token expiration
        if (!user.ScadenzaTokenAggiornamento.HasValue || user.ScadenzaTokenAggiornamento.Value < DateTime.UtcNow)
        {
            user.TokenAggiornamento = null;
            user.ScadenzaTokenAggiornamento = null;
            await dbContext.SaveChangesAsync();
            return Unauthorized(new { message = "Refresh token scaduto" });
        }

        // SECURITY FIX: Check if account is disabled (could be disabled after login)
        if (user.Disabilitato == true)
        {
            return Unauthorized(new { message = "Account disabilitato" });
        }

        Claim[] userClaims = [
            new Claim(ClaimTypes.Name, user.NomeUtente),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("UserId", user.Id.ToString()),
        ];

        var (RefreshToken, Token) = jwtHelper.CreateSignedToken(userClaims);
        user.TokenAggiornamento = RefreshToken;
        // SECURITY FIX: Update refresh token expiration on rotation
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);

        await dbContext.SaveChangesAsync();
        return new ObjectResult(new { Token, RefreshToken });
    }

    [HttpPost("logout"), AllowAnonymous]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest? request = null)
    {
        // SECURITY FIX: Accept expired JWTs for logout
        // Try to extract user ID from the request body token first, then fall back to Authorization header
        int userId = 0;

        // 1. Try from request body
        if (!string.IsNullOrEmpty(request?.Token))
        {
            var principal = jwtHelper.GetPrincipalFromExpiredToken(request.Token);
            if (principal != null)
            {
                userId = jwtHelper.GetUserID(principal);
            }
        }

        // 2. Fallback: try from Authorization header
        if (userId == 0)
        {
            string? authHeader = Request.Headers.Authorization.FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                string token = authHeader["Bearer ".Length..];
                var principal = jwtHelper.GetPrincipalFromExpiredToken(token);
                if (principal != null)
                {
                    userId = jwtHelper.GetUserID(principal);
                }
            }
        }

        // 3. Fallback: try from current authenticated user (if JWT is still valid)
        if (userId == 0)
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(claim))
            {
                userId = Convert.ToInt32(claim);
            }
        }

        if (userId > 0)
        {
            var user = await dbContext.Utenti.FindAsync(userId);
            if (user != null)
            {
                user.TokenAggiornamento = null;
                user.ScadenzaTokenAggiornamento = null;
                await dbContext.SaveChangesAsync();
            }
        }

        // Clear the refresh token cookie
        Response.Cookies.Delete("refreshToken", new CookieOptions
        {
            HttpOnly = true,
            Secure = !env.IsDevelopment(),
            SameSite = env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.Strict,
            Path = "/api/auth",
        });

        return Ok(new { message = "Logged out successfully" });
    }
}

public record SignInRequest(string Username, string Password);
public record LogoutRequest(string? Token);
