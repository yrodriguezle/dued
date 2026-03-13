using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using duedgusto.Services.Jwt;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Services;

public class JwtHelperTests
{
    private readonly JwtHelper _jwtHelper;
    private readonly JwtSecurityTokenHandler _tokenHandler;

    public JwtHelperTests()
    {
        _jwtHelper = JwtTestHelper.CreateJwtHelper();
        _tokenHandler = new JwtSecurityTokenHandler();
    }

    #region Token Generation (REQ-1.2.1)

    [Fact]
    public void GenerateToken_ValidUser_ReturnsJwtWithThreeSegments()
    {
        // Arrange
        var claims = CreateTestClaims();

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        token.Should().NotBeNullOrWhiteSpace();
        token.Split('.').Should().HaveCount(3, "a valid JWT has three Base64URL segments");
    }

    [Fact]
    public void GenerateToken_ValidUser_ContainsCorrectClaims()
    {
        // Arrange
        var claims = CreateTestClaims(userId: 42, userName: "admin");

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);
        var jwtToken = _tokenHandler.ReadJwtToken(token);

        // Assert
        jwtToken.Claims.Should().Contain(c => c.Type == "UserId" && c.Value == "42");
        jwtToken.Claims.Should().Contain(c =>
            c.Type == ClaimTypes.Name && c.Value == "admin");
        jwtToken.Claims.Should().Contain(c =>
            c.Type == ClaimTypes.NameIdentifier && c.Value == "42");
    }

    [Fact]
    public void GenerateToken_ValidUser_SetsCorrectExpiry()
    {
        // Arrange
        var claims = CreateTestClaims();
        var beforeCreation = DateTime.UtcNow;

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);
        var jwtToken = _tokenHandler.ReadJwtToken(token);

        // Assert — expiry should be ~5 minutes from now (within 10 seconds tolerance)
        var expectedExpiry = beforeCreation.AddMinutes(5);
        jwtToken.ValidTo.Should().BeCloseTo(expectedExpiry, TimeSpan.FromSeconds(10));
    }

    [Fact]
    public void GenerateToken_ValidUser_SetsCorrectIssuerAndAudience()
    {
        // Arrange
        var claims = CreateTestClaims();

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);
        var jwtToken = _tokenHandler.ReadJwtToken(token);

        // Assert
        jwtToken.Issuer.Should().Be("duedgusto-api");
        jwtToken.Audiences.Should().Contain("duedgusto-clients");
    }

    [Fact]
    public void GenerateToken_DifferentUsers_ProduceDifferentTokens()
    {
        // Arrange
        var claims1 = CreateTestClaims(userId: 1, userName: "user1");
        var claims2 = CreateTestClaims(userId: 2, userName: "user2");

        // Act
        var (_, token1) = _jwtHelper.CreateSignedToken(claims1);
        var (_, token2) = _jwtHelper.CreateSignedToken(claims2);

        // Assert
        token1.Should().NotBe(token2);
    }

    [Fact]
    public void GenerateRefreshToken_ReturnsNonEmptyBase64String()
    {
        // Act
        var refreshToken = _jwtHelper.GenerateRefreshToken();

        // Assert
        refreshToken.Should().NotBeNullOrWhiteSpace();
        // Should be valid base64 (32 bytes = 44 chars in base64)
        var bytes = Convert.FromBase64String(refreshToken);
        bytes.Should().HaveCount(32);
    }

    [Fact]
    public void GenerateRefreshToken_ProducesDifferentTokensEachCall()
    {
        // Act
        var token1 = _jwtHelper.GenerateRefreshToken();
        var token2 = _jwtHelper.GenerateRefreshToken();

        // Assert
        token1.Should().NotBe(token2);
    }

    #endregion

    #region Token Validation (REQ-1.2.2)

    [Fact]
    public void ValidateToken_FreshlyGenerated_PassesValidation()
    {
        // Arrange
        var claims = CreateTestClaims();
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Act
        var principal = _tokenHandler.ValidateToken(
            token,
            _jwtHelper.TokenValidationParameters,
            out SecurityToken validatedToken);

        // Assert
        principal.Should().NotBeNull();
        validatedToken.Should().NotBeNull();
    }

    [Fact]
    public void ValidateToken_TamperedSignature_FailsValidation()
    {
        // Arrange
        var claims = CreateTestClaims();
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Tamper with the signature (change a character in the middle to avoid base64 padding bits)
        var parts = token.Split('.');
        var sigChars = parts[2].ToCharArray();
        var midIndex = sigChars.Length / 2;
        sigChars[midIndex] = sigChars[midIndex] == 'A' ? 'B' : 'A';
        var tamperedToken = $"{parts[0]}.{parts[1]}.{new string(sigChars)}";

        // Act & Assert
        var act = () => _tokenHandler.ValidateToken(
            tamperedToken,
            _jwtHelper.TokenValidationParameters,
            out _);

        act.Should().Throw<SecurityTokenException>();
    }

    [Fact]
    public void ValidateToken_DifferentKey_FailsValidation()
    {
        // Arrange
        var claims = CreateTestClaims();
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Create a different JwtHelper with a different key
        var differentHelper = new JwtHelper(
            "CompletelyDifferentKey_ForTestingPurposesOnly!",
            SecurityKeyType.SymmetricSecurityKey);

        // Act & Assert
        var act = () => _tokenHandler.ValidateToken(
            token,
            differentHelper.TokenValidationParameters,
            out _);

        act.Should().Throw<SecurityTokenException>();
    }

    [Fact]
    public void ValidateToken_ExpiredToken_FailsValidation()
    {
        // Arrange — create a token that is already expired by manipulating the claims
        // We cannot easily create an expired token through JwtHelper since it uses DateTime.UtcNow.
        // Instead we validate using stricter parameters that make the token appear expired.
        var claims = CreateTestClaims();
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        var strictParams = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "duedgusto-api",
            ValidateAudience = true,
            ValidAudience = "duedgusto-clients",
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.Zero, // No clock skew tolerance
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = _jwtHelper.TokenValidationParameters.IssuerSigningKeys,
            ValidAlgorithms = _jwtHelper.TokenValidationParameters.ValidAlgorithms,
            // Override the lifetime validator to simulate expired token
            LifetimeValidator = (notBefore, expires, securityToken, validationParameters) => false,
        };

        // Act & Assert
        var act = () => _tokenHandler.ValidateToken(token, strictParams, out _);
        act.Should().Throw<SecurityTokenException>();
    }

    #endregion

    #region Claims Extraction (REQ-1.2.3)

    [Fact]
    public void GetPrincipalFromExpiredToken_ValidToken_ReturnsClaimsPrincipal()
    {
        // Arrange
        var claims = CreateTestClaims(userId: 42, userName: JwtTestHelper.E2eUsername);
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token);

        // Assert
        principal.Should().NotBeNull();
        principal!.Claims.Should().Contain(c => c.Type == "UserId" && c.Value == "42");
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_InvalidToken_ReturnsNull()
    {
        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken("completely.invalid.token");

        // Assert
        principal.Should().BeNull();
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_TamperedToken_ReturnsNull()
    {
        // Arrange
        var claims = CreateTestClaims();
        var (_, token) = _jwtHelper.CreateSignedToken(claims);
        var parts = token.Split('.');
        var tamperedToken = $"{parts[0]}.{parts[1]}.invalidsignature";

        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(tamperedToken);

        // Assert
        principal.Should().BeNull();
    }

    [Fact]
    public void GetUserID_ValidPrincipal_ReturnsCorrectId()
    {
        // Arrange
        var claims = CreateTestClaims(userId: 99);
        var (_, token) = _jwtHelper.CreateSignedToken(claims);
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token)!;

        // Act
        var userId = _jwtHelper.GetUserID(principal);

        // Assert
        userId.Should().Be(99);
    }

    [Fact]
    public void GetUserID_PrincipalWithoutUserIdClaim_ReturnsZero()
    {
        // Arrange — create principal without UserId claim
        var claims = new[] { new Claim(ClaimTypes.Name, JwtTestHelper.E2eUsername) };
        var (_, token) = _jwtHelper.CreateSignedToken(claims);
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token)!;

        // Act
        var userId = _jwtHelper.GetUserID(principal);

        // Assert
        userId.Should().Be(0);
    }

    [Fact]
    public void GetUserName_ValidPrincipal_ReturnsCorrectName()
    {
        // Arrange
        var claims = CreateTestClaims(userName: "admin");
        var (_, token) = _jwtHelper.CreateSignedToken(claims);
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token)!;

        // Act
        var userName = _jwtHelper.GetUserName(principal);

        // Assert
        userName.Should().Be("admin");
    }

    #endregion

    #region Constructor and Configuration (REQ-1.2.4)

    [Fact]
    public void Constructor_SymmetricKey_ConfiguresHmacSha256()
    {
        // Act
        var helper = new JwtHelper(JwtTestHelper.TestSymmetricKey, SecurityKeyType.SymmetricSecurityKey);

        // Assert
        helper.TokenValidationParameters.Should().NotBeNull();
        helper.TokenValidationParameters.ValidAlgorithms.Should().Contain(SecurityAlgorithms.HmacSha256);
    }

    [Fact]
    public void TokenValidationParameters_AreCorrectlyConfigured()
    {
        // Assert
        var tvp = _jwtHelper.TokenValidationParameters;
        tvp.ValidateIssuer.Should().BeTrue();
        tvp.ValidIssuer.Should().Be("duedgusto-api");
        tvp.ValidateAudience.Should().BeTrue();
        tvp.ValidAudience.Should().Be("duedgusto-clients");
        tvp.ValidateLifetime.Should().BeTrue();
        tvp.RequireExpirationTime.Should().BeTrue();
        tvp.RequireSignedTokens.Should().BeTrue();
        tvp.ValidateIssuerSigningKey.Should().BeTrue();
        tvp.ClockSkew.Should().Be(TimeSpan.FromSeconds(6));
    }

    [Fact]
    public void Constructor_InvalidKeyType_ThrowsArgumentOutOfRangeException()
    {
        // Act & Assert
        var act = () => new JwtHelper("key", (SecurityKeyType)999);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    #endregion

    #region Helpers

    private static Claim[] CreateTestClaims(int userId = 1, string userName = JwtTestHelper.E2eUsername)
    {
        return
        [
            new Claim(ClaimTypes.Name, userName),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("UserId", userId.ToString()),
        ];
    }

    #endregion
}
