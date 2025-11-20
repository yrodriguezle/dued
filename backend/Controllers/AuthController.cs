using System.Security.Claims;
using System.Security.Cryptography;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Authentication;
using duedgusto.Services.Jwt;
using duedgusto.Services.Csrf;
using duedgusto.Services.HashPassword;

namespace duedgusto.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class AuthController(AppDbContext dbContext, JwtHelper jwtHelper, CsrfTokenGenerator csrfTokenGenerator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAuthenticatedUser()
    {
        int userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        if (userId == 0)
        {
            return Unauthorized(new { message = "Utente non autenticato" });
        }

        User? user = await dbContext.User
            .Include(u => u.Role)
            .ThenInclude(r => r.Menus)
            .FirstOrDefaultAsync(x => x.UserId == userId);

        if (user == null)
        {
            return Unauthorized(new { message = "Utente non autenticato" });
        }

        return Ok(new
        {
            user.UserId,
            user.UserName,
            user.FirstName,
            user.LastName,
            user.Description,
            user.Disabled,
            Role = user.Role != null ? new
            {
                user.Role.RoleId,
                user.Role.RoleName,
                user.Role.RoleDescription
            } : null,
            Menus = user.Role != null ? user.Role.Menus.Select(m => new
            {
                m.MenuId,
                m.Title,
                m.Path,
                m.Icon,
                m.ViewName,
                m.FilePath,
                m.IsVisible,
                m.ParentMenuId,
            }) : []
        });
    }


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

        User? user = await dbContext.User.FirstOrDefaultAsync(x => x.UserName == request.Username);

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
        if (user!.Disabled == true)
        {
            return Unauthorized(new { message = "Account disabilitato. Contatta l'amministratore." });
        }

        Claim[] claims = [
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim("UserId", user.UserId.ToString()),
        ];

        (string RefreshToken, string Token) = jwtHelper.CreateSignedToken(claims);
        user.RefreshToken = RefreshToken;
        // SECURITY FIX: Add server-side expiration for refresh token
        user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);

        await dbContext.SaveChangesAsync();

        // Generate CSRF token for subsequent requests
        var csrfToken = csrfTokenGenerator.GenerateToken();

        // Set CSRF token as non-httpOnly cookie (must be readable by JavaScript)
        Response.Cookies.Append(
            "csrfToken",
            csrfToken,
            new CookieOptions
            {
                HttpOnly = false, // Must be readable by JavaScript
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Path = "/",
                MaxAge = TimeSpan.FromDays(7),
            }
        );

        // Set refresh token as httpOnly cookie for improved security
        Response.Cookies.Append(
            "refreshToken",
            RefreshToken,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = true, // Only send over HTTPS in production
                SameSite = SameSiteMode.Strict, // CSRF protection
                Path = "/api/auth", // Only send to auth endpoints
                MaxAge = TimeSpan.FromDays(7), // 7-day expiration
            }
        );

        // Return only access token in response body (not refresh token)
        return Ok(new { token = Token });
    }

    [HttpPost("refresh"), AllowAnonymous]
    public async Task<IActionResult> RefreshToken([FromBody] TokenResponse request)
    {
        User? user = await dbContext.User.FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);

        // SECURITY FIX: Validate refresh token and its expiration
        if (user == null || user.RefreshTokenExpiresAt == null || user.RefreshTokenExpiresAt < DateTime.UtcNow)
        {
            return Unauthorized(new { message = "Invalid or expired refresh token" });
        }

        // SECURITY FIX: Check if account is disabled (could be disabled after login)
        if (user.Disabled == true)
        {
            return Unauthorized(new { message = "Account disabilitato" });
        }

        Claim[] userClaims = [
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim("UserId", user.UserId.ToString()),
        ];

        var (RefreshToken, Token) = jwtHelper.CreateSignedToken(userClaims);
        user.RefreshToken = RefreshToken;
        // SECURITY FIX: Update refresh token expiration on rotation
        user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(7);

        await dbContext.SaveChangesAsync();

        // Generate new CSRF token (token rotation)
        var csrfToken = csrfTokenGenerator.GenerateToken();

        // Set CSRF token as non-httpOnly cookie (must be readable by JavaScript)
        Response.Cookies.Append(
            "csrfToken",
            csrfToken,
            new CookieOptions
            {
                HttpOnly = false, // Must be readable by JavaScript
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Path = "/",
                MaxAge = TimeSpan.FromDays(7),
            }
        );

        // Set refresh token as httpOnly cookie for improved security
        Response.Cookies.Append(
            "refreshToken",
            RefreshToken,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = true, // Only send over HTTPS in production
                SameSite = SameSiteMode.Strict, // CSRF protection
                Path = "/api/auth", // Only send to auth endpoints
                MaxAge = TimeSpan.FromDays(7), // 7-day expiration
            }
        );

        // Return only access token in response body (not refresh token)
        return new ObjectResult(new { token = Token });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        // SECURITY FIX: Invalidate refresh token in database
        int userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        if (userId > 0)
        {
            var user = await dbContext.User.FindAsync(userId);
            if (user != null)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiresAt = null;
                await dbContext.SaveChangesAsync();
            }
        }

        // Clear the CSRF token cookie
        Response.Cookies.Delete("csrfToken", new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
        });

        // Clear the refresh token cookie
        Response.Cookies.Delete("refreshToken", new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/api/auth",
        });

        return Ok(new { message = "Logged out successfully" });
    }
}

public record SignInRequest(string Username, string Password);
