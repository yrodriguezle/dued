using DueD.Helpers;
using System;
using System.Collections.Generic;

namespace DueD.Models
{
    public class User : IEntity
    {
        public User()
        {
            Keys = Guid.NewGuid().ToString();
        }

        public int UserId { get; set; }
        public string? UserName { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Description { get; set; }
        public byte[]? PasswordHash { get; set; }
        public byte[]? PasswordSalt { get; set; }
        public bool? AdminPrivilege { get; set; }
        public bool? Disabled { get; set; }
        public bool? LogActivity { get; set; }
        public TimeSpan? LimitAccessStartTime { get; set; }
        public TimeSpan? LimitAccessEndTime { get; set; }
        public string? RememberToken { get; set; }

        public string Keys { get; set; }
    }
}
