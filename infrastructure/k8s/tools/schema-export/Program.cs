using ClimateGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

if (args.Length != 1) throw new InvalidOperationException("Expected an output SQL path.");
// GenerateCreateScript only builds model metadata; it NEVER opens this connection.
var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseSqlServer("Server=not-used.invalid;Database=MetadataOnly;Integrated Security=true;Connect Timeout=1").Options;
using var db = new AppDbContext(options);
var ddl = db.Database.GenerateCreateScript();
if (ddl.Contains("DROP TABLE", StringComparison.OrdinalIgnoreCase) || ddl.Contains("INSERT INTO", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Unexpected destructive/data statements; review the model privately.");
var guarded = "-- Fresh, EMPTY database only. No credentials or business records.\nSET XACT_ABORT ON;\nBEGIN TRANSACTION;\nIF EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped=0) THROW 51000, 'Database is not empty; refusing initialization.', 1;\nGO\n" + ddl + "\nCOMMIT;\n";
File.WriteAllText(args[0], guarded);
Console.WriteLine("Offline SQL schema exported. No database connection or initialization performed.");
