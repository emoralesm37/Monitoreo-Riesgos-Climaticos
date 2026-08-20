namespace ClimateGuard.Domain.Entities;

public sealed class AuditLogEntry
{
    public int AuditLogEntryId { get; set; }

    public int UserId { get; set; }

    public string Action { get; set; } = string.Empty;

    public string? EntityAffected { get; set; }

    public DateTime Timestamp { get; set; }

    public string? Details { get; set; }

    public User User { get; set; } = null!;
}