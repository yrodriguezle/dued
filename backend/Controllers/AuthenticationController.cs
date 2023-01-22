using System.Security.Claims;
using System.ComponentModel.DataAnnotations;

using Microsoft.AspNetCore.Mvc;
using GraphQL;
using DueD.Models;
using DueD.Repositories;
using DueD.Helpers;
using IAuthenticationService = DueD.Services.IAuthenticationService;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace DueD.Controllers
{
    public class TokenModel
    {
        public string Token { get; set; }
        public string RefreshToken { get; set; }
        public TokenModel()
        {
            Token = string.Empty;
            RefreshToken = string.Empty;
        }
    }

    public class AccessModel
    {
        [Required]
        public string Username { get; set; }
        [Required]
        public string Password { get; set; }
        public string NewPassword { get; set; }
        public AccessModel()
        {
            Username = string.Empty;
            Password = string.Empty;
            NewPassword = string.Empty;
        }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class AuthenticationController : ControllerBase
    {
        private readonly IAuthenticationService _authService;
        private readonly IRepository _repository;
        private readonly IPasswordHasher _passwordHasher;

        public AuthenticationController(IAuthenticationService authService, IPasswordHasher passwordHasher, IRepository repository)
        {
            _authService = authService;
            _repository = repository;
            _passwordHasher = passwordHasher;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] AccessModel accessModel)
        {
            User? user = await _repository.User.GetByUsername(accessModel.Username);

            if (user == null || !_passwordHasher.VerifyPasswordHash(accessModel.Password, user.PasswordHash, user.PasswordSalt))
            {
                return Unauthorized(new { message = "Utente o password non validi!" });
            }

            //_passwordHasher.CreatePasswordHash(accessModel.Password, out byte[] passwordHash, out byte[] passwordSalt);
            //user.PasswordHash = passwordHash;
            //user.PasswordSalt = passwordSalt;
            //await _repository.User.AddOrUpdate(user);

            Claim[] usersClaims = new[]
            {
                new Claim(ClaimTypes.Name, user?.UserName),
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim("userId", user.UserId.ToString()),
            };
            string jwtToken = _authService.GenerateAccessToken(usersClaims);
            string jwtRefreshToken = _authService.GenerateRefreshToken();
            user.RememberToken = jwtRefreshToken;
            await _repository.User.AddOrUpdate(user);

            return new ObjectResult(new
            {
                token = jwtToken,
                refreshToken = jwtRefreshToken,
            });
        }

        [HttpPost]
        public async Task<IActionResult> Post([FromBody] TokenModel refreshTokenModel)
        {
            try
            {
                ClaimsPrincipal principal = _authService.GetPrincipalFromExpiredToken(refreshTokenModel.Token);
                string username = principal?.Identity?.Name ?? string.Empty;

                User? user = await _repository.User.GetByUsername(username);

                if (user is null || user.RememberToken == null || !user.RememberToken.Equals(refreshTokenModel.RefreshToken))
                {
                    return Unauthorized(new { message = "Si è verificato un errore caricando l'utente!" });
                }
                return new ObjectResult(new
                {
                    token = _authService.GenerateAccessToken(principal.Claims),
                    refreshToken = user.RememberToken,
                });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
    }
}
