namespace ClimateGuard.Domain.Entities;

public sealed class User
{
    public int UserId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public byte RoleId { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public Role Role { get; set; } = null!;

    public ICollection<Alert> ResolvedAlerts { get; set; } =
        new List<Alert>();

    public ICollection<AuditLogEntry> AuditLogEntries { get; set; } =
        new List<AuditLogEntry>();

    public ICollection<RefreshToken> RefreshTokens { get; set; } =
        new List<RefreshToken>();
}