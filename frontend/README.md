# Frontend - ClimateGuard

Interfaz web del Sistema de Monitoreo y Alerta Temprana para Riesgos Climáticos. Construida con Angular 20+.

## Tecnologías

- Angular 20+ (standalone components, `@for`/`@if` control flow)
- SCSS
- HttpClient para consumo de la API REST

## Estructura del proyecto

```
src/app/
├── core/
│   ├── services/       # Servicios singleton (auth, sensores)
│   ├── guards/          # Guards de rutas
│   └── interceptors/    # Interceptores HTTP
├── shared/
│   └── components/      # Componentes reutilizables (badges de severidad)
├── layout/
│   ├── header/           # Barra superior
│   ├── sidebar/          # Menú de navegación
│   └── main-layout/      # Contenedor que combina header + sidebar + router-outlet
└── features/
    ├── dashboard/         # Panel de indicadores climáticos
    ├── sensores/          # Listado y administración de sensores (conectado a API real)
    ├── alertas/           # Alertas activas por severidad
    ├── historial/         # Historial de eventos climáticos
    └── usuarios/           # Gestión de usuarios y bitácora
```

## Cómo levantar el proyecto localmente

### Requisitos
- Node.js 18+
- Angular CLI (`npm install -g @angular/cli`)
- Backend corriendo en `http://localhost:7000` (ver README de `backend/`)

### Pasos

```bash
cd frontend
npm install
ng serve
```

La aplicación queda disponible en `http://localhost:4200`.

### Configuración de la API

La URL del backend se configura en `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:7000/api'
};
```

## Estado actual de cada módulo

| Módulo | Estado | Notas |
|---|---|---|
| Layout y navegación | ✅ Completo | Rutas, header, sidebar, responsive básico |
| Sensores | ✅ Conectado a API real | GET y cambio de estado (PATCH) funcionando contra el backend |
| Dashboard | 🟡 Datos de ejemplo | Pendiente conectar a lecturas reales |
| Alertas | 🟡 Datos de ejemplo | Incluye notificación sonora al cargar |
| Historial | 🟡 Datos de ejemplo | Pendiente conectar y agregar filtros |
| Usuarios | 🟡 Datos de ejemplo | Pendiente endpoint de backend (no implementado aún) |
| Login / autenticación | ⏳ Pendiente | Depende de endpoint de auth en el backend |
| SignalR (tiempo real) | ⏳ Pendiente | Depende de hub de backend |

## Notas de desarrollo

- Los contratos de datos (forma de `Sensor`, `Alerta`, etc.) siguen el acuerdo documentado por el equipo antes de iniciar desarrollo.
- El servicio `SensoresService` (`core/services/sensores.ts`) ya implementa `getAll`, `getById`, `create`, `changeStatus` y `reset` contra la API real; el resto de módulos usan arreglos fijos en espera de que los endpoints correspondientes del backend estén disponibles (Alerts, Users, Auth no existen aún en el backend al momento de este commit).
- Diseño visual: tipografía Inter, paleta de severidad consistente (verde `#22c55e`, amarillo `#eab308`, naranja `#f97316`, rojo `#ef4444`), sidebar oscuro con ítem activo en azul `#2563eb`.
