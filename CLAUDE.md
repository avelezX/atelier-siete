# CLAUDE.md - Contexto del Proyecto Atelier Siete

> Documentacion para futuras sesiones de Claude Code

## Resumen del Proyecto

**Atelier Siete** es un sistema de gestion para el almacen de muebles y decoracion de la misma familia propietaria de Saman WM SA.

### Objetivos Principales

1. **Conectar con Siigo** para ver facturas, notas credito, productos y clientes
2. **Visualizar** datos del negocio en dashboards
3. **Gestionar** inventario y costeo de productos
4. **Cumplir** con normativa colombiana (DIAN)

---

## Arquitectura del Sistema

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **UI Components**: Lucide React icons

### Backend
- **Base de datos**: PostgreSQL via Supabase (proyecto separado de Hermes)
- **API**: Next.js API Routes
- **Integracion**: Siigo API (facturas, notas credito, productos, clientes)

---

## Estructura del Proyecto

```
atelier-siete/
├── app/
│   ├── layout.tsx              # Layout principal con Sidebar
│   ├── page.tsx                # Dashboard
│   ├── globals.css             # Estilos globales
│   ├── invoices/
│   │   └── page.tsx            # Lista de facturas desde Siigo
│   ├── credit-notes/
│   │   └── page.tsx            # Lista de notas credito
│   ├── products/
│   │   └── page.tsx            # Catalogo de productos
│   ├── customers/
│   │   └── page.tsx            # Lista de clientes
│   └── api/
│       └── siigo/
│           ├── auth/route.ts       # Test conexion Siigo
│           ├── invoices/route.ts   # GET facturas
│           ├── credit-notes/route.ts # GET notas credito
│           ├── products/route.ts   # GET productos
│           └── customers/route.ts  # GET clientes
├── components/
│   └── Sidebar.tsx             # Navegacion principal (amber theme)
├── lib/
│   ├── supabase.ts             # Cliente Supabase + atelierTable() helper
│   ├── siigo.ts                # Cliente Siigo API (auth, fetch, paginacion)
│   └── utils.ts                # formatCurrency, formatDate, truncate
├── types/
│   └── siigo.ts                # Tipos TypeScript para Siigo API
├── .env.local                  # Variables de entorno (NO en git)
├── .env.local.example          # Template de variables
├── CLAUDE.md                   # Este archivo
└── package.json
```

---

## Integracion Siigo

### Endpoints Disponibles

| Recurso | Endpoint | Implementado |
|---------|----------|-------------|
| Facturas | `/v1/invoices` | Si |
| Notas Credito | `/v1/credit-notes` | Si |
| Productos | `/v1/products` | Si |
| Clientes | `/v1/customers` | Si |
| Impuestos | `/v1/taxes` | Si (lib) |
| Tipos de Pago | `/v1/payment-types` | Si (lib) |
| Crear Factura | `POST /v1/invoices` | Si (lib) |

### Autenticacion Siigo

- POST `/auth` con `username` + `access_key`
- Token valido 24h, cacheado 23h
- Header: `Authorization: {token}` (sin Bearer)
- Header: `Partner-Id: atelierSiete`

---

## Variables de Entorno

**Archivo**: `.env.local` (NO en git)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SIIGO_USERNAME=...
SIIGO_ACCESS_KEY=...
SIIGO_API_URL=https://api.siigo.com
```

---

## Relacion con Hermes

Este proyecto es **independiente** de Hermes (Saman WM SA):
- Repositorio separado
- Proyecto Supabase separado
- Credenciales Siigo diferentes (cuenta de Atelier Siete)
- Misma base de codigo (Next.js + Supabase + Siigo)

El codigo del cliente Siigo fue copiado y adaptado de Hermes.

---

## Contexto de Negocio

**Empresa**: Atelier Siete
**Industria**: Retail — Muebles y decoracion
**Ubicacion**: Colombia
**Sistemas**: Siigo (facturacion, inventario, contabilidad)

---

## Comandos Utiles

```bash
# Desarrollo
npm run dev

# Produccion
npm run build
npm start

# Test conexion Siigo
curl http://localhost:3000/api/siigo/auth
```

---

## Convenciones

- **Color theme**: Amber/orange (en lugar del blue/indigo de Hermes)
- **Naming**: camelCase para variables, PascalCase para componentes
- **Supabase helper**: `atelierTable('nombre')` para tablas con prefijo `atelier_`
- Server components para paginas, client components para interactividad

---

**Ultima actualizacion**: Febrero 20, 2026
**Version**: 0.1.0 (Setup inicial + Siigo)
