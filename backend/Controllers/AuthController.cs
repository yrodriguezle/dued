﻿using System.Security.Claims;

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
public class AuthController(AppDbContext dbContext, JwtHelper jwtHelper) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> GetAuthenticatedUser()
    {
        int userId = Convert.ToInt32(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        if (userId == 0) {
            return Unauthorized(new { message = "Utente non autenticato" });
        }
        User? user = await dbContext.User.FirstOrDefaultAsync((x) => x.UserId == userId);
        if (user == null)
        {
            return Unauthorized(new { message = "Utente non autenticato" });
        }
        return Ok(user);
    }

    [HttpPost("signin"), AllowAnonymous]
    public async Task<IActionResult> SignIn([FromBody] SignInRequest request)
    {
        User? user = await dbContext.User.FirstOrDefaultAsync(x => x.UserName == request.Username);
        if (user == null)
        {
            return Unauthorized(new { message = "Credenziali non valide" });
        }

        bool isValid = PasswordService.VerifyPassword(request.Password, user.Hash, user.Salt);
        if (!isValid)
        {
            return Unauthorized(new { message = "Credenziali non valide" });
        }

        Claim[] claims = [
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim("UserId", user.UserId.ToString()),
        ];

        (string RefreshToken, string Token) = jwtHelper.CreateSignedToken(claims);
        user.RefreshToken = RefreshToken;
        
        await dbContext.SaveChangesAsync();

        TokenResponse response = new(Token, RefreshToken);
        return Ok(response);
    }

    [HttpPost("refresh"), AllowAnonymous]
    public async Task<IActionResult> RefreshToken([FromBody] TokenResponse request)
    {
        User? user = await dbContext.User.FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);
        if (user == null)
        {
            return Unauthorized(new { message = "Invalid refresh token" });
        }

        Claim[] userClaims = [
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim("UserId", user.UserId.ToString()),
        ];

        var (RefreshToken, Token) = jwtHelper.CreateSignedToken(userClaims);
        user.RefreshToken = RefreshToken;

        await dbContext.SaveChangesAsync();
        TokenResponse response = new(Token, RefreshToken);
        return new ObjectResult(response);
    }
}

public record SignInRequest(string Username, string Password);
