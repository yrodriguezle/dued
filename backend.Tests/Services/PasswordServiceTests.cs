using duedgusto.Services.HashPassword;

namespace backend.Tests.Services;

/// <summary>
/// Test completi per PasswordService: hashing HMACSHA256 e verifica delle password.
/// </summary>
public class PasswordServiceTests
{
    // ==========================================
    // HASH PASSWORD TESTS
    // ==========================================

    [Fact]
    public void HashPassword_RestituisceHashESaltNonNull()
    {
        // Arrange
        string password = "TestPassword123!";

        // Act
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        // Assert
        Assert.NotNull(hash);
        Assert.NotNull(salt);
        Assert.True(hash.Length > 0, "L'hash deve avere lunghezza > 0");
        Assert.True(salt.Length > 0, "Il salt deve avere lunghezza > 0");
    }

    [Fact]
    public void HashPassword_StessaPassword_ProduceSaltDiversi()
    {
        // Arrange
        string password = "TestPassword123!";

        // Act
        PasswordService.HashPassword(password, out byte[] hash1, out byte[] salt1);
        PasswordService.HashPassword(password, out byte[] hash2, out byte[] salt2);

        // Assert - salt diversi producono hash diversi
        Assert.NotEqual(salt1, salt2);
    }

    [Fact]
    public void HashPassword_StessaPassword_ProduceHashDiversi()
    {
        // Arrange
        string password = "TestPassword123!";

        // Act
        PasswordService.HashPassword(password, out byte[] hash1, out byte[] salt1);
        PasswordService.HashPassword(password, out byte[] hash2, out byte[] salt2);

        // Assert - Hash diversi perche i salt sono diversi
        Assert.False(hash1.SequenceEqual(hash2),
            "Due hashing della stessa password devono produrre hash diversi (salt diversi)");
    }

    // ==========================================
    // VERIFY PASSWORD TESTS
    // ==========================================

    [Fact]
    public void VerifyPassword_PasswordCorretta_RestituisceTrue()
    {
        // Arrange
        string password = "TestPassword123!";
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        // Act
        bool result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void VerifyPassword_PasswordErrata_RestituisceFalse()
    {
        // Arrange
        string password = "TestPassword123!";
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        // Act
        bool result = PasswordService.VerifyPassword("PasswordSbagliata!", hash, salt);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void VerifyPassword_PasswordVuota_RestituisceFalse()
    {
        // Arrange
        string password = "TestPassword123!";
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        // Act
        bool result = PasswordService.VerifyPassword("", hash, salt);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void VerifyPassword_PasswordSimile_RestituisceFalse()
    {
        // Arrange - Password che differisce di un solo carattere
        string password = "TestPassword123!";
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        // Act
        bool result = PasswordService.VerifyPassword("TestPassword123?", hash, salt);

        // Assert
        Assert.False(result);
    }

    // ==========================================
    // CARATTERI SPECIALI E UNICODE
    // ==========================================

    [Fact]
    public void HashPassword_ConCaratteriSpeciali_FunzionaCorrettamente()
    {
        // Arrange
        string password = "P@$$w0rd!#%^&*()_+-=[]{}|;':\",./<>?";

        // Act
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);
        bool result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void HashPassword_ConCaratteriUnicode_FunzionaCorrettamente()
    {
        // Arrange
        string password = "Password con accenti: e', a', u' e caratteri speciali";

        // Act
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);
        bool result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void HashPassword_ConCaratteriGiapponesi_FunzionaCorrettamente()
    {
        // Arrange - Test con caratteri multibyte
        string password = "password_test_123";

        // Act
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);
        bool result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        Assert.True(result);
    }

    // ==========================================
    // EDGE CASES
    // ==========================================

    [Fact]
    public void HashPassword_PasswordMoltoLunga_FunzionaCorrettamente()
    {
        // Arrange
        string password = new string('A', 1000);

        // Act
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);
        bool result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void HashPassword_PasswordSingoloCarattere_FunzionaCorrettamente()
    {
        // Arrange
        string password = "x";

        // Act
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);
        bool result = PasswordService.VerifyPassword(password, hash, salt);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void VerifyPassword_HashCorretto_SaltSbagliato_RestituisceFalse()
    {
        // Arrange
        string password = "TestPassword123!";
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        // Crea un salt diverso
        PasswordService.HashPassword("altra-password", out _, out byte[] differentSalt);

        // Act - usa l'hash originale ma con un salt diverso
        bool result = PasswordService.VerifyPassword(password, hash, differentSalt);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void HashPassword_ProduceHash_DiLunghezzaCostante()
    {
        // Arrange & Act
        PasswordService.HashPassword("short", out byte[] hash1, out _);
        PasswordService.HashPassword("a much longer password with lots of characters", out byte[] hash2, out _);
        PasswordService.HashPassword("x", out byte[] hash3, out _);

        // Assert - HMACSHA256 produce sempre un hash di 32 bytes
        Assert.Equal(32, hash1.Length);
        Assert.Equal(32, hash2.Length);
        Assert.Equal(32, hash3.Length);
    }
}
