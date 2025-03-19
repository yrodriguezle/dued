using System.Security.Cryptography;

namespace duedgusto.Services.HashPassword;

public class PasswordService
{
    public static void HashPassword(string password, out byte[] hash, out byte[] salt)
    {
        using HMACSHA256 hmac = new();
        salt = hmac.Key;
        hash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
    }

    public static bool VerifyPassword(string password, byte[] hash, byte[] salt)
    {
        using HMACSHA256 hmac = new(salt);
        var computedHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
        for (int i = 0; i < computedHash.Length; i++)
        {
            if (computedHash[i] != hash[i]) return false;
        }
        return true;
    }
}
