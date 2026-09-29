
# Diseño de Base de Datos — Sistema de Monitoreo y Alerta Temprana

Motor: **SQL Server 2022+**. Este documento acompaña  y define el modelo de
datos que la capa `Infrastructure` (EF Core) debe implementar.

---

## 1. Entidades identificadas

A partir del enunciado del proyecto, las entidades persistentes son:

1. **Roles** — catálogo de roles (Admin, Operador).
2. **Users** — usuarios que acceden al sistema.
3. **Communities** — comunidades rurales monitoreadas (permite escalar sin tocar arquitectura).
4. **SensorTypes** — catálogo de tipos de sensor (Temperatura, Humedad, VelocidadViento, NivelLluvia, NivelRio).
5. **Sensors** — sensores físicos/simulados, ubicados en una comunidad.
6. **SensorReadings** — lecturas históricas de cada sensor (serie de tiempo).
7. **AlertSeverities** — catálogo de severidades (Verde, Amarillo, Naranja, Rojo).
8. **PhenomenonTypes** — catálogo de fenómenos (Inundación, Sequía, Tormenta, Helada, Incendio forestal).
9. **Alerts** — alertas/eventos generados (esto también cubre el "Historial de Eventos").
10. **AuditLogEntries** — bitácora de acciones de los usuarios.
11. **RefreshTokens** — tokens de refresco para JWT.

> **Decisión (simplificada a pedido del usuario):** los umbrales de alerta (qué valor de qué tipo de
> sensor dispara qué severidad) **no** se modelan como tabla `AlertThresholds`. Se manejan como
> configuración fija en `appsettings.json` o constantes dentro de `IAlertRuleEvaluator`
> (capa Application/Infrastructure). Esto reduce una tabla y sus joins, a costa de que cambiar un
> umbral requiera redeploy/config-reload en vez de un CRUD — aceptable para el alcance de un proyecto
> académico (YAGNI: no construir un motor de reglas dinámico si no lo piden).

> Nota de diseño: los catálogos (Roles, SensorTypes, AlertSeverities, PhenomenonTypes) existen como
> tablas separadas — y no como `string`/enum embebido — precisamente por **3FN**: evitan que atributos
> descriptivos (como el nombre de la severidad) dependan transitivamente de la PK de `Alerts` en lugar
> de depender de su propia clave.

---

## 2. Diagrama de relaciones (texto)

```text
Roles (1) ────────────< Users (N)
Communities (1) ───────< Sensors (N)
SensorTypes (1) ────────< Sensors (N)
Sensors (1) ───────────< SensorReadings (N)
Sensors (1) ───────────< Alerts (N)               [SensorId nullable: alerta puede ser del sistema]
AlertSeverities (1) ───< Alerts (N)
PhenomenonTypes (1) ───< Alerts (N)   [nullable: no toda lectura genera un fenómeno]
Users (1) ─────────────< AuditLogEntries (N)
Users (1) ─────────────< RefreshTokens (N)
Users (1) ─────────────< Alerts (N)   [ResolvedByUserId, nullable — quién marcó la alerta resuelta]
RefreshTokens (1) ─────< RefreshTokens (N)  [ReplacedByTokenId, auto-referencia por rotación]
```

---

## 3. Tablas, campos, tipos y llaves

### 3.1 `Roles`
| Campo | Tipo | Restricciones |
|---|---|---|
| RoleId | `TINYINT` | **PK** |
| Name | `NVARCHAR(30)` | `UNIQUE`, `NOT NULL` (Admin, Operador) |

### 3.2 `Users`
| Campo | Tipo | Restricciones |
|---|---|---|
| UserId | `INT IDENTITY` | **PK** |
| Name | `NVARCHAR(100)` | `NOT NULL` |
| Email | `NVARCHAR(150)` | `UNIQUE`, `NOT NULL` |
| PasswordHash | `NVARCHAR(300)` | `NOT NULL` |
| RoleId | `TINYINT` | **FK →** `Roles.RoleId`, `NOT NULL` |
| IsActive | `BIT` | `NOT NULL DEFAULT 1` |
| CreatedAt | `DATETIME2` | `NOT NULL DEFAULT SYSUTCDATETIME()` |
| UpdatedAt | `DATETIME2` | `NULL` |

### 3.3 `Communities`
| Campo | Tipo | Restricciones |
|---|---|---|
| CommunityId | `INT IDENTITY` | **PK** |
| Name | `NVARCHAR(120)` | `UNIQUE`, `NOT NULL` |
| Region | `NVARCHAR(120)` | `NULL` |
| Latitude | `DECIMAL(9,6)` | `NULL` (para mapa opcional) |
| Longitude | `DECIMAL(9,6)` | `NULL` |

### 3.4 `SensorTypes`
| Campo | Tipo | Restricciones |
|---|---|---|
| SensorTypeId | `TINYINT` | **PK** |
| Code | `NVARCHAR(30)` | `UNIQUE`, `NOT NULL` (Temperatura, Humedad, VelocidadViento, NivelLluvia, NivelRio) |
| Unit | `NVARCHAR(15)` | `NOT NULL` (°C, %, km/h, mm, m) |

### 3.5 `Sensors`
| Campo | Tipo | Restricciones |
|---|---|---|
| SensorId | `INT IDENTITY` | **PK** |
| Name | `NVARCHAR(100)` | `NOT NULL` |
| SensorTypeId | `TINYINT` | **FK →** `SensorTypes.SensorTypeId`, `NOT NULL` |
| CommunityId | `INT` | **FK →** `Communities.CommunityId`, `NOT NULL` |
| IsActive | `BIT` | `NOT NULL DEFAULT 1` |
| LastValue | `DECIMAL(10,2)` | `NULL` (cache de la última lectura, denormalizado a propósito — ver §5) |
| LastUpdatedAt | `DATETIME2` | `NULL` |
| CreatedAt | `DATETIME2` | `NOT NULL DEFAULT SYSUTCDATETIME()` |
| UpdatedAt | `DATETIME2` | `NULL` |

### 3.6 `SensorReadings`
| Campo | Tipo | Restricciones |
|---|---|---|
| SensorReadingId | `BIGINT IDENTITY` | **PK** |
| SensorId | `INT` | **FK →** `Sensors.SensorId`, `NOT NULL` |
| Value | `DECIMAL(10,2)` | `NOT NULL` |
| Timestamp | `DATETIME2` | `NOT NULL DEFAULT SYSUTCDATETIME()` |

Índice: `IX_SensorReadings_SensorId_Timestamp` (SensorId, Timestamp DESC) — acelera las consultas de
evolución/histórico por sensor.

### 3.7 `AlertSeverities`
| Campo | Tipo | Restricciones |
|---|---|---|
| AlertSeverityId | `TINYINT` | **PK** |
| Name | `NVARCHAR(20)` | `UNIQUE`, `NOT NULL` (Verde, Amarillo, Naranja, Rojo) |
| Level | `TINYINT` | `NOT NULL` (0-3, para ordenar/comparar severidad) |

### 3.8 `PhenomenonTypes`
| Campo | Tipo | Restricciones |
|---|---|---|
| PhenomenonTypeId | `TINYINT` | **PK** |
| Name | `NVARCHAR(30)` | `UNIQUE`, `NOT NULL` (Inundación, Sequía, Tormenta, Helada, IncendioForestal) |

### 3.9 `Alerts`
| Campo | Tipo | Restricciones |
|---|---|---|
| AlertId | `BIGINT IDENTITY` | **PK** |
| SensorId | `INT` | **FK →** `Sensors.SensorId`, `NULL` (alertas de sistema sin sensor puntual) |
| AlertSeverityId | `TINYINT` | **FK →** `AlertSeverities.AlertSeverityId`, `NOT NULL` |
| PhenomenonTypeId | `TINYINT` | **FK →** `PhenomenonTypes.PhenomenonTypeId`, `NULL` |
| TriggerValue | `DECIMAL(10,2)` | `NULL` (valor de lectura que disparó la alerta) |
| Message | `NVARCHAR(300)` | `NOT NULL` |
| CreatedAt | `DATETIME2` | `NOT NULL DEFAULT SYSUTCDATETIME()` |
| ResolvedAt | `DATETIME2` | `NULL` |
| ResolvedByUserId | `INT` | **FK →** `Users.UserId`, `NULL` |

Índice: `IX_Alerts_CreatedAt` y `IX_Alerts_SensorId` para filtros de historial.

### 3.10 `AuditLogEntries`
| Campo | Tipo | Restricciones |
|---|---|---|
| AuditLogEntryId | `BIGINT IDENTITY` | **PK** |
| UserId | `INT` | **FK →** `Users.UserId`, `NOT NULL` |
| Action | `NVARCHAR(60)` | `NOT NULL` (ej. "CreateSensor", "DeactivateSensor") |
| EntityAffected | `NVARCHAR(60)` | `NULL` (ej. "Sensor#12") |
| Timestamp | `DATETIME2` | `NOT NULL DEFAULT SYSUTCDATETIME()` |
| Details | `NVARCHAR(500)` | `NULL` |

### 3.11 `RefreshTokens`
| Campo | Tipo | Restricciones |
|---|---|---|
| RefreshTokenId | `INT IDENTITY` | **PK** |
| UserId | `INT` | **FK →** `Users.UserId`, `NOT NULL` |
| TokenHash | `NVARCHAR(300)` | `NOT NULL` |
| ExpiresAt | `DATETIME2` | `NOT NULL` |
| CreatedAt | `DATETIME2` | `NOT NULL DEFAULT SYSUTCDATETIME()` |
| RevokedAt | `DATETIME2` | `NULL` |
| ReplacedByTokenId | `INT` | **FK →** `RefreshTokens.RefreshTokenId` (auto-referencia), `NULL` |
| CreatedByIp | `NVARCHAR(45)` | `NULL` |

---

## 4. Resumen de relaciones (cardinalidad)

| Padre | Hijo | Cardinalidad | FK |
|---|---|---|---|
| Roles | Users | 1:N | Users.RoleId |
| Communities | Sensors | 1:N | Sensors.CommunityId |
| SensorTypes | Sensors | 1:N | Sensors.SensorTypeId |
| Sensors | SensorReadings | 1:N | SensorReadings.SensorId |
| Sensors | Alerts | 1:N (0..1 opcional) | Alerts.SensorId |
| AlertSeverities | Alerts | 1:N | Alerts.AlertSeverityId |
| PhenomenonTypes | Alerts | 1:N (opcional) | Alerts.PhenomenonTypeId |
| Users | AuditLogEntries | 1:N | AuditLogEntries.UserId |
| Users | RefreshTokens | 1:N | RefreshTokens.UserId |
| Users | Alerts | 1:N (opcional) | Alerts.ResolvedByUserId |
| RefreshTokens | RefreshTokens | 1:N (opcional, auto-ref) | RefreshTokens.ReplacedByTokenId |

No hay relaciones N:M en este modelo — todas se resuelven con FK simples, por lo que **no se requieren
tablas puente**.

---

## 5. Normalización — 1FN → 3FN

### 1FN (Primera Forma Normal): valores atómicos, sin grupos repetidos
- Cada columna almacena un único valor atómico (ej. `Value` en `SensorReadings` es un solo número, no
  una lista de lecturas separadas por coma).
- No hay columnas repetidas tipo `Reading1, Reading2, Reading3` — en su lugar, `SensorReadings` es una
  tabla de series de tiempo con una fila por lectura.
- Todas las tablas tienen una PK explícita que identifica cada fila de forma única.
-  **Cumple 1FN.**

### 2FN (Segunda Forma Normal): sin dependencias parciales
- 2FN solo aplica cuando la PK es **compuesta**. En este modelo, todas las PK son sustitutas de una
  sola columna (`XxxId IDENTITY`); no hay ninguna PK compuesta en el esquema.
- Como no hay PK compuestas, no puede existir dependencia parcial (un atributo que dependa de solo
  una parte de la clave).
-  **Cumple 2FN automáticamente.**

### 3FN (Tercera Forma Normal): sin dependencias transitivas
Aquí es donde se justifican las decisiones de diseño más importantes:

- **Problema evitado #1 — Sensor mezclado con datos de comunidad.**
  Si `Sensors` tuviera columnas `CommunityName`, `Region`, `Latitude`, `Longitude` directamente, esos
  campos dependerían de `CommunityId`, no de `SensorId` → dependencia transitiva.
  **Solución:** se extrajo `Communities` como tabla propia; `Sensors` solo guarda `CommunityId` (FK).

- **Problema evitado #2 — Nombre de severidad/fenómeno repetido en `Alerts`.**
  Si `Alerts` tuviera una columna `SeverityName NVARCHAR(20)` en vez de `AlertSeverityId`, el nombre
  dependería del código de severidad, no directamente de `AlertId` → dependencia transitiva, además de
  redundancia (el mismo texto "Rojo" repetido en miles de filas).
  **Solución:** catálogos `AlertSeverities` y `PhenomenonTypes` con FK numérica desde `Alerts`.

- **Problema evitado #3 — Unidad de medida del sensor repetida en cada lectura.**
  `SensorReadings` no almacena la unidad (`°C`, `mm`, etc.) porque esa unidad depende del
  `SensorTypeId` del sensor, no de la lectura en sí. Se obtiene por join a través de
  `Sensors → SensorTypes`.
  **Solución:** unidad vive una sola vez en `SensorTypes.Unit`.

- **Problema evitado #4 — Rol embebido como texto en `Users`.**
  En vez de `Users.RoleName NVARCHAR(30)`, se usa `Users.RoleId` (FK a `Roles`), evitando que el
  nombre del rol dependa de un valor no-clave repetido en cada usuario.

- **Excepción consciente — `Sensors.LastValue` / `LastUpdatedAt`.**
  Estos dos campos son **denormalización intencional** (caché), no un error de 3FN: técnicamente el
  último valor se puede derivar de `MAX(Timestamp)` en `SensorReadings`, pero mantener una copia en
  `Sensors` evita un `JOIN` costoso en cada refresco del dashboard/tabla de sensores (miles de
  lecturas por sensor). Se documenta explícitamente para que quede claro que es una decisión de
  rendimiento, no un descuido de normalización. Debe mantenerse sincronizado únicamente desde el
  `SensorSimulationBackgroundService` (una sola fuente de escritura, evita anomalías de actualización).

-  **Cumple 3FN** (con la única denormalización documentada y justificada arriba).

---

## 6. Notas para EF Core

- Usa `Fluent API` (`IEntityTypeConfiguration<T>` por entidad en `Infrastructure/Persistence/Configurations`)
  en vez de Data Annotations, para mantener el Domain limpio de atributos de EF (ver regla de la
  arquitectura: *Domain no debe depender de EF Core*).
- Los catálogos (`Roles`, `SensorTypes`, `AlertSeverities`, `PhenomenonTypes`) se siembran (`Seed`) con
  `HasData()` en las migraciones — son datos de referencia fijos, no CRUD de usuario final.
- Los umbrales de alerta (`AlertThresholds`) viven como configuración en `appsettings.json` (sección
  `AlertRules`), leídos por `IAlertRuleEvaluator` vía `IOptions<T>` — no requieren tabla ni migración.
  Si más adelante se necesita editarlos sin redeploy, se puede promover a tabla en una iteración futura
  (YAGNI: no construir eso hasta que realmente se necesite).
- `Communities` sí es CRUD completo de Admin (no solo seed), porque el enunciado exige poder agregar
  sensores en nuevas comunidades sin tocar la arquitectura.
