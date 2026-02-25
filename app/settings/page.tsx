'use client';

import { useState } from 'react';
import {
  Settings,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Server,
  Link2,
  FileText,
  RefreshCw,
  Wrench,
} from 'lucide-react';

type Tab = 'general' | 'docs';

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium text-gray-800 hover:bg-gray-50 rounded-lg"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <Icon className="w-4 h-4 text-amber-600" />
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 border-b border-gray-200 font-medium text-gray-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 border-b border-gray-100 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800">{children}</code>;
}

function DocsTab() {
  return (
    <div className="space-y-4">
      {/* Section 1: Dashboard APIs */}
      <Section title="APIs del Dashboard" icon={Server} defaultOpen>
        <DocTable
          headers={['Endpoint', 'Metodo', 'Descripcion', 'Parametros']}
          rows={[
            ['/api/dashboard/ventas', 'GET', 'Resumen de ventas por producto y proveedor', 'month, start/end'],
            ['/api/dashboard/resumen', 'GET', 'Resumen general: ventas, costos, margenes', 'month, start/end'],
            ['/api/dashboard/resumen/mes', 'GET', 'Resumen desglosado por mes', 'start/end'],
            ['/api/dashboard/iva', 'GET', 'Calculo de IVA generado vs descontable', 'month, start/end'],
            ['/api/dashboard/retencion', 'GET', 'Retencion en la fuente y renta', 'month, start/end'],
            ['/api/dashboard/costo-cero', 'GET', 'Productos vendidos SIN costo registrado', 'month, start/end'],
            ['/api/dashboard/costos-estimados', 'GET', 'Costo estimado (70%) vs costo real por producto', 'month, start/end'],
            ['/api/dashboard/cost-tracking', 'GET', 'Seguimiento detallado: costo compra, costo journal, margen', 'start/end'],
          ]}
        />
        <Note>
          <strong>Calculo de ingresos sin IVA:</strong> Los endpoints de costos usan <Code>line_total - tax_value</Code> para
          obtener ingresos sin IVA. El <Code>sale_price</Code> de productos incluye IVA y se convierte
          dividiendo entre 1.19.
        </Note>
      </Section>

      {/* Section 2: Siigo APIs */}
      <Section title="APIs de Siigo" icon={Link2}>
        <DocTable
          headers={['Endpoint', 'Metodo', 'Descripcion', 'En Siigo Nube']}
          rows={[
            ['/api/siigo/auth', 'GET', 'Prueba conexion con Siigo', '—'],
            ['/api/siigo/products', 'GET', 'Todos los productos', 'Inventario > Productos'],
            ['/api/siigo/customers', 'GET', 'Todos los clientes/terceros', 'Terceros > Clientes'],
            ['/api/siigo/invoices', 'GET', 'Facturas de venta', 'Ventas > Facturas de Venta'],
            ['/api/siigo/credit-notes', 'GET', 'Notas credito', 'Ventas > Notas Credito'],
            ['/api/siigo/purchases', 'GET', 'Compras / facturas de compra', 'Compras > Facturas de Compra'],
            ['/api/siigo/journals', 'GET', 'Consultar comprobante por ID', 'Contabilidad > Comprobantes > Diarios'],
            ['/api/siigo/document-types', 'GET', 'Tipos de documento (filtro ?type=CC)', 'Contabilidad > Plan > Tipos de Comprobante'],
          ]}
        />
      </Section>

      {/* Section 3: Crear Comprobante */}
      <Section title='Boton "Crear Comprobante"' icon={FileText}>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            <strong>Disponible desde:</strong> Costos Estimados y Costos Reales (seleccionar productos y presionar
            &quot;Crear Comprobante&quot;).
          </p>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Flujo de creacion</h4>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Seleccionar productos en la tabla</li>
              <li>Presionar &quot;Crear Comprobante&quot; — abre el modal</li>
              <li>El modal carga tipos de documento CC desde <Code>/api/siigo/document-types?type=CC</Code></li>
              <li>Auto-selecciona tipo &quot;Costeo&quot; si existe</li>
              <li>Elegir modo de fecha:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li><strong>Fecha unica:</strong> todos los productos con la misma fecha</li>
                  <li><strong>Por mes:</strong> agrupa por mes de venta, fecha = ultimo dia del mes</li>
                </ul>
              </li>
              <li>Costos editables (sugerido = 70% del precio sin IVA)</li>
              <li>Envio a <Code>POST /api/siigo/journals</Code></li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Contabilizacion (partida doble)</h4>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 font-mono text-xs">
              <div>DEBITO:&nbsp; 6135 — Costo de Ventas (cuenta COGS)</div>
              <div>CREDITO: 1435 — Inventario (reduce stock contable)</div>
              <div className="mt-1 text-gray-500">Tercero: NIT 901764924</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Valores por defecto</h4>
            <DocTable
              headers={['Campo', 'Valor']}
              rows={[
                ['Cuenta COGS', '61350501'],
                ['Cuenta Inventario', '14350101'],
                ['Productos por comprobante', '50 (batch)'],
                ['Observaciones', '"Costeo [Mes Año]"'],
              ]}
            />
          </div>

          <Note>
            <strong>Batching:</strong> Si hay mas de 50 productos, se crean multiples comprobantes. Cada
            uno queda como diario independiente en Siigo.
          </Note>

          <Note>
            <strong>En Siigo Nube:</strong> Contabilidad &rarr; Comprobantes &rarr; Diarios &rarr; buscar por
            nombre o fecha del comprobante.
          </Note>
        </div>
      </Section>

      {/* Section 4: Sincronizacion */}
      <Section title="Sincronizacion" icon={RefreshCw}>
        <DocTable
          headers={['Endpoint', 'Metodo', 'Descripcion']}
          rows={[
            ['/api/sync', 'POST', 'Sincroniza TODA la data de Siigo a Supabase'],
            ['/api/sync/status', 'GET', 'Estado de ultima sincronizacion'],
          ]}
        />
        <div className="mt-3 text-sm text-gray-700">
          <p>
            La sincronizacion completa descarga: productos, clientes, facturas, notas credito, compras,
            comprobantes (journals) y vouchers. Elimina y reinserta <Code>journal_items</Code> para
            mantener consistencia.
          </p>
        </div>
      </Section>

      {/* Section 5: Otros endpoints */}
      <Section title="Otros endpoints" icon={Wrench}>
        <DocTable
          headers={['Endpoint', 'Metodo', 'Descripcion']}
          rows={[
            ['/api/auth/login', 'POST', 'Login de la aplicacion'],
            ['/api/debug/journals', 'GET', 'Debug de journals tipo CC (ultimos 3 meses)'],
            ['/api/siigo/test-endpoints', 'GET', 'Prueba conectividad a todos los endpoints de Siigo'],
            ['/api/suppliers', 'GET', 'Lista proveedores con conteo de productos'],
            ['/api/suppliers/duplicates', 'GET', 'Detecta proveedores duplicados'],
            ['/api/suppliers/merge', 'POST', 'Fusiona proveedores duplicados'],
          ]}
        />
      </Section>

      {/* Section 6: Referencia cruzada Siigo */}
      <Section title="Referencia cruzada Siigo Nube" icon={Link2}>
        <DocTable
          headers={['Accion en Atelier', 'Donde verlo en Siigo Nube']}
          rows={[
            ['Crear comprobante de costeo', 'Contabilidad > Comprobantes > Diarios'],
            ['Ver facturas sincronizadas', 'Ventas > Facturas de Venta'],
            ['Ver notas credito', 'Ventas > Notas Credito'],
            ['Ver productos', 'Inventario > Productos'],
            ['Ver terceros/clientes', 'Terceros > Clientes'],
            ['Ver compras', 'Compras > Facturas de Compra'],
            ['Declaracion IVA', 'Contabilidad > Informes > Form 300 (cuatrimestral)'],
            ['Retencion en la fuente', 'Contabilidad > Informes > Form 350 (mensual)'],
            ['Renta', 'Contabilidad > Informes > Form 110 (anual)'],
          ]}
        />
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('docs');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Settings className="w-6 h-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajustes</h1>
          <p className="text-sm text-gray-500">Configuracion y documentacion del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          General
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'docs'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Documentacion
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">Configuracion general</p>
          <p className="text-sm mt-1">Proximamente</p>
        </div>
      )}

      {activeTab === 'docs' && <DocsTab />}
    </div>
  );
}
