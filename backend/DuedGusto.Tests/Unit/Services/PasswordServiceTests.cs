using duedgusto.Services.HashPassword;

namespace DuedGusto.Tests.Unit.Services;

public class PasswordServiceTests
{
    #region Password Hashing (REQ-1.3.1)

    [Fact]
    public void HashPassword_ValidPassword_ProducesNonEmptyHashAndSalt()
    {
        // Act
        PasswordService.HashPassword("SecureP@ss123", out byte[] hash, out byte[] salt);

        // Assert
        hash.Should().NotBeEmpty();
        salt.Should().NotBeEmpty();
    }

    [Fact]
    public void HashPassword_SamePassword_ProducesDifferentHashes()
    {
        // Arrange
        const string password = "SecureP@ss123";

        // Act
        PasswordService.HashPassword(password, out byte[] hash1, out byte[] salt1);
        PasswordService.HashPassword(password, out byte[] hash2, out byte[] salt2);

        // Assert — different salts lead to different hashes
        salt1.Should().NotEqual(salt2);
        hash1.Should().NotEqual(hash2);
    }

    [Fact]
    public void HashPassword_ValidPassword_ProducesConsistentHashLength()
    {
        // HMACSHA256 produces 32-byte hashes
        PasswordService.HashPassword("test", out byte[] hash, out byte[] salt);

        hash.Should().HaveCount(32);
        salt.Should().NotBeEmpty();
    }

    #endregion

    #region Password Verification (REQ-1.3.2)

    [Fact]
    public void VerifyPassword_CorrectPassword_ReturnsTrue()
    {
        // Arrange
        const string password = "MyPassword1!";
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        // Act
        var result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void VerifyPassword_WrongPassword_ReturnsFalse()
    {
        // Arrange
        PasswordService.HashPassword("MyPassword1!", out byte[] hash, out byte[] salt);

        // Act
        var result = PasswordService.VerifyPassword("WrongPassword", hash, salt);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void VerifyPassword_SlightlyDifferentPassword_ReturnsFalse()
    {
        // Arrange
        PasswordService.HashPassword("MyPassword1!", out byte[] hash, out byte[] salt);

        // Act
        var result = PasswordService.VerifyPassword("MyPassword1", hash, salt);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region Edge Cases (REQ-1.3.3)

    [Fact]
    public void HashPassword_EmptyString_ProducesValidHashAndSalt()
    {
        // Act
        PasswordService.HashPassword("", out byte[] hash, out byte[] salt);

        // Assert
        hash.Should().NotBeEmpty();
        salt.Should().NotBeEmpty();
    }

    [Fact]
    public void VerifyPassword_EmptyString_MatchesItsOwnHash()
    {
        // Arrange
        PasswordService.HashPassword("", out byte[] hash, out byte[] salt);

        // Act & Assert
        PasswordService.VerifyPassword("", hash, salt).Should().BeTrue();
        PasswordService.VerifyPassword("notempty", hash, salt).Should().BeFalse();
    }

    [Fact]
    public void HashPassword_UnicodeCharacters_WorksCorrectly()
    {
        // Arrange
        const string password = "\u00e8\u00e0\u00f2\u00f9\u00e9\u00fc\u00f6\u00e4\u2603\ud83d\ude00";

        // Act
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);
        var result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        hash.Should().NotBeEmpty();
        result.Should().BeTrue();
    }

    [Fact]
    public void HashPassword_LongPassword_WorksCorrectly()
    {
        // Arrange
        var longPassword = new string('A', 1500);

        // Act
        PasswordService.HashPassword(longPassword, out byte[] hash, out byte[] salt);
        var result = PasswordService.VerifyPassword(longPassword, hash, salt);

        // Assert
        hash.Should().NotBeEmpty();
        result.Should().BeTrue();
    }

    [Fact]
    public void VerifyPassword_LongPassword_WrongPassword_ReturnsFalse()
    {
        // Arrange
        var longPassword = new string('A', 1500);
        PasswordService.HashPassword(longPassword, out byte[] hash, out byte[] salt);

        // Act
        var result = PasswordService.VerifyPassword(new string('B', 1500), hash, salt);

        // Assert
        result.Should().BeFalse();
    }

    #endregion
}
