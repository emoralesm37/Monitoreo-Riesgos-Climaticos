namespace ClimateGuard.Domain.Entities;

public sealed class Role
{
    public byte RoleId { get; set; }

    public string Name { get; set; } = string.Empty;

    public ICollection<User> Users { get; set; } = new List<User>();
}