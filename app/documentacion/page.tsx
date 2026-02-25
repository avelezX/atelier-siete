'use client';

import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  FileText,
  RefreshCw,
  Calculator,
  Database,
  TrendingUp,
  Receipt,
  Package,
  Users,
  FileMinus2,
  DollarSign,
  AlertTriangle,
  Landmark,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

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

function SiigoStep({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">En Siigo Nube</p>
      <div className="text-sm text-blue-900">{children}</div>
    </div>
  );
}

function AtelierStep({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded">
      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">En Atelier Siete</p>
      <div className="text-sm text-amber-900">{children}</div>
    </div>
  );
}

function Workflow({ siigo, atelier }: { siigo: React.ReactNode; atelier: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-start">
      <SiigoStep>{siigo}</SiigoStep>
      <div className="hidden md:flex items-center justify-center pt-6">
        <ArrowRight className="w-5 h-5 text-gray-400" />
      </div>
      <div className="md:hidden flex justify-center">
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </div>
      <AtelierStep>{atelier}</AtelierStep>
    </div>
  );
}

export default function DocumentacionPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-amber-100 rounded-lg">
          <BookOpen className="w-6 h-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentacion</h1>
          <p className="text-sm text-gray-500">Guia de uso — Siigo Nube vs Atelier Siete</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-6 ml-14">
        Cada seccion muestra como se hacia en <strong className="text-blue-600">Siigo Nube</strong> y
        como se hace ahora en <strong className="text-amber-600">Atelier Siete</strong>.
      </p>

      <div className="space-y-4">

        {/* Section 1: Que es Atelier Siete */}
        <Section title="Que es Atelier Siete?" icon={LayoutDashboard} defaultOpen>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <strong>Atelier Siete</strong> reemplaza la necesidad de navegar en Siigo Nube para las
              tareas del dia a dia. Toda la informacion contable de Siigo se sincroniza y se presenta
              en dashboards optimizados para el negocio de muebles y decoracion.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Antes (Siigo Nube)</p>
                <ul className="text-sm text-blue-900 space-y-1">
                  <li>&bull; Navegar menu por menu para buscar datos</li>
                  <li>&bull; Exportar a Excel para cruzar informacion</li>
                  <li>&bull; Crear comprobantes linea por linea manualmente</li>
                  <li>&bull; Calcular margenes y costos en hojas de calculo</li>
                  <li>&bull; Revisar multiples reportes para armar el P&L</li>
                </ul>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Ahora (Atelier Siete)</p>
                <ul className="text-sm text-amber-900 space-y-1">
                  <li>&bull; Todo en un solo lugar con dashboards visuales</li>
                  <li>&bull; Cruces automaticos entre ventas, compras y costos</li>
                  <li>&bull; Comprobantes de costeo con un click</li>
                  <li>&bull; Margenes calculados en tiempo real por producto</li>
                  <li>&bull; Estado de Resultados completo generado automaticamente</li>
                </ul>
              </div>
            </div>
            <Note>
              <strong>Importante:</strong> Siigo sigue siendo la fuente de verdad. Atelier lee los datos
              de Siigo y los presenta de forma mas util. La unica accion que modifica Siigo es la
              creacion de comprobantes contables de costeo.
            </Note>
          </div>
        </Section>

        {/* Section 2: Consultar Facturas de Venta */}
        <Section title="Consultar Facturas de Venta" icon={FileText} defaultOpen>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Ventas</strong> en el menu principal</li>
                  <li>Click en <strong>Facturas de Venta</strong></li>
                  <li>Filtrar por rango de fechas</li>
                  <li>Navegar pagina por pagina para encontrar una factura</li>
                  <li>Click en cada factura para ver el detalle</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Facturas</strong> en el menu lateral</li>
                  <li>Todas las facturas se muestran con filtro de fecha</li>
                  <li>Ver cliente, total, items y estado en la misma vista</li>
                </ol>
              }
            />
            <Note>
              Las facturas se sincronizan desde Siigo. Para ver las mas recientes, ejecutar primero
              una <strong>Sincronizacion</strong> desde el menu lateral.
            </Note>
          </div>
        </Section>

        {/* Section 3: Consultar Notas Credito */}
        <Section title="Consultar Notas Credito (Devoluciones)" icon={FileMinus2}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Ventas</strong> en el menu principal</li>
                  <li>Click en <strong>Notas Credito</strong></li>
                  <li>Filtrar por fecha o cliente</li>
                  <li>Abrir cada nota para ver productos devueltos</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Notas Credito</strong> en el menu lateral</li>
                  <li>Ver todas las notas con cliente, monto e items</li>
                  <li>Filtrar por rango de fechas</li>
                </ol>
              }
            />
          </div>
        </Section>

        {/* Section 4: Consultar Productos */}
        <Section title="Consultar Productos e Inventario" icon={Package}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Inventario</strong> en el menu principal</li>
                  <li>Click en <strong>Productos</strong></li>
                  <li>Buscar por codigo o nombre</li>
                  <li>Abrir cada producto para ver precio, proveedor y grupo contable</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Productos</strong> en el menu lateral</li>
                  <li>Catalogo completo con precio, proveedor y grupo</li>
                  <li>Busqueda integrada por nombre o codigo</li>
                </ol>
              }
            />
          </div>
        </Section>

        {/* Section 5: Consultar Clientes */}
        <Section title="Consultar Clientes" icon={Users}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Terceros</strong> en el menu principal</li>
                  <li>Click en <strong>Clientes</strong></li>
                  <li>Buscar por NIT, cedula o nombre</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Clientes</strong> en el menu lateral</li>
                  <li>Lista completa con identificacion y contacto</li>
                </ol>
              }
            />
          </div>
        </Section>

        {/* Section 6: Ver Estado de Resultados */}
        <Section title="Ver Estado de Resultados (P&L)" icon={BarChart3}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Informes</strong> en el menu principal</li>
                  <li>Click en <strong>Contabilidad</strong> &rarr; <strong>Estado de Resultados</strong></li>
                  <li>Seleccionar periodo (un solo mes o rango)</li>
                  <li>Exportar a Excel para analizar</li>
                  <li>Cruzar manualmente ventas con costos y gastos</li>
                  <li>No muestra desglose por proveedor ni por producto</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Resumen</strong> en el menu lateral</li>
                  <li>P&L completo con <strong>todos los meses</strong> en una sola tabla</li>
                  <li>Ventas, costos, gastos, IVA y renta calculados automaticamente</li>
                  <li>Click en cualquier mes para ver desglose por producto y proveedor</li>
                  <li>Gastos desglosados por categoria (admin, ventas, financieros)</li>
                </ol>
              }
            />
            <Note>
              El Resumen incluye: Ventas Brutas, Notas Credito, Ventas Netas, Costo de Ventas,
              Utilidad Bruta, Gastos (admin/venta/financieros), Utilidad Operativa, IVA Neto y
              Renta Estimada — todo calculado automaticamente.
            </Note>
          </div>
        </Section>

        {/* Section 7: Analizar Ventas por Proveedor */}
        <Section title="Analizar Ventas por Proveedor" icon={TrendingUp}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Exportar facturas a Excel</li>
                  <li>Cruzar con catalogo de productos para obtener proveedor</li>
                  <li>Crear tabla dinamica por proveedor y mes</li>
                  <li>Separar manualmente consignacion de inventario propio</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Ventas</strong> en el menu lateral</li>
                  <li>Ver ventas desglosadas por proveedor y mes</li>
                  <li>Consignacion y propio separados automaticamente</li>
                  <li>Click en proveedor para ver detalle de productos</li>
                </ol>
              }
            />
          </div>
        </Section>

        {/* Section 8: Calcular IVA */}
        <Section title="Calcular IVA" icon={Receipt}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Contabilidad</strong> &rarr; <strong>Informes</strong></li>
                  <li>Buscar <strong>Formulario 300</strong> (declaracion cuatrimestral)</li>
                  <li>Seleccionar periodo</li>
                  <li>Revisar IVA generado, descontable y a pagar</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>IVA</strong> en el menu lateral</li>
                  <li>Ver IVA generado, notas credito, descontable y neto por cuatrimestre</li>
                  <li>Desglose automatico: facturas, compras y notas credito</li>
                </ol>
              }
            />
          </div>
        </Section>

        {/* Section 9: Retencion y Renta */}
        <Section title="Calcular Retencion en la Fuente y Renta" icon={Landmark}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Contabilidad</strong> &rarr; <strong>Informes</strong></li>
                  <li><strong>Formulario 350</strong> para retencion mensual</li>
                  <li><strong>Formulario 110</strong> para renta anual</li>
                  <li>Consultar con contador para estimaciones</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Renta y Retencion</strong> en el menu lateral</li>
                  <li>Retencion mensual calculada automaticamente</li>
                  <li>Renta estimada: 35% sobre utilidad operativa positiva</li>
                </ol>
              }
            />
            <Note>
              La renta estimada es una aproximacion. Para la declaracion oficial, consultar
              con el contador y usar el Formulario 110 en Siigo.
            </Note>
          </div>
        </Section>

        {/* Section 10: Productos sin Costo */}
        <Section title="Identificar Productos sin Costo" icon={AlertTriangle}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Exportar facturas de venta a Excel</li>
                  <li>Exportar comprobantes contables (journals) a Excel</li>
                  <li>Cruzar manualmente para encontrar productos vendidos sin costo</li>
                  <li>Proceso largo y propenso a errores</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Costo Cero</strong> en el menu lateral</li>
                  <li>Lista automatica de productos vendidos sin costo en Siigo</li>
                  <li>Muestra proveedor, cantidad vendida e ingreso</li>
                </ol>
              }
            />
          </div>
        </Section>

        {/* Section 11: Registrar Costo de Ventas */}
        <Section title="Registrar Costo de Ventas (Comprobante de Costeo)" icon={DollarSign}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Esta es la funcion mas importante: reemplaza el proceso manual de crear comprobantes
              contables linea por linea en Siigo para registrar el costo de cada producto vendido.
            </p>
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Contabilidad</strong> &rarr; <strong>Comprobantes</strong> &rarr; <strong>Nuevo</strong></li>
                  <li>Seleccionar tipo <strong>CC</strong> (Comprobante Contable)</li>
                  <li>Elegir la fecha del comprobante</li>
                  <li>Por cada producto vendido, agregar <strong>2 lineas</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Linea DEBITO: cuenta <Code>61350501</Code> (Costo de Ventas)</li>
                      <li>Linea CREDITO: cuenta <Code>14350101</Code> (Inventario)</li>
                    </ul>
                  </li>
                  <li>Escribir el tercero (NIT de la empresa)</li>
                  <li>Poner el valor del costo en cada linea</li>
                  <li>Repetir para <strong>cada producto</strong> — si vendiste 30 productos, son 60 lineas</li>
                  <li>Verificar que debitos = creditos</li>
                  <li>Guardar el comprobante</li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ir a <strong>Costos Estimados</strong> o <strong>Costos Reales</strong></li>
                  <li>Seleccionar los productos con el checkbox</li>
                  <li>Click en <strong>&quot;Crear Comprobante Contable&quot;</strong></li>
                  <li>El sistema:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Auto-selecciona tipo CC y subtipo &quot;Costeo&quot;</li>
                      <li>Pone la fecha correcta (por mes de venta)</li>
                      <li>Calcula debitos y creditos automaticamente</li>
                      <li>Agrupa en lotes de 50 productos maximo</li>
                    </ul>
                  </li>
                  <li>Ajustar costos si es necesario (editables)</li>
                  <li>Click en <strong>&quot;Crear&quot;</strong> — listo</li>
                </ol>
              }
            />

            <div className="text-sm text-gray-700">
              <h4 className="font-medium text-gray-800 mb-2">Contabilizacion generada automaticamente</h4>
              <div className="bg-gray-50 border border-gray-200 rounded p-3 font-mono text-xs">
                <div>Por cada producto se crean 2 movimientos:</div>
                <div className="mt-2"><strong>DEBITO:</strong>&nbsp; 61350501 — Costo de Ventas (registra el gasto)</div>
                <div><strong>CREDITO:</strong> 14350101 — Inventario (reduce el stock contable)</div>
                <div className="mt-2 text-gray-500">Tercero: NIT 901764924 | Valor: costo del producto</div>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <h4 className="font-medium text-gray-800 mb-2">Donde verificar en Siigo Nube</h4>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Ir a <strong>Contabilidad</strong> &rarr; <strong>Comprobantes</strong> &rarr; <strong>Diarios</strong></li>
                <li>Buscar por fecha o por nombre del documento (ej: <Code>CC-00001234</Code>)</li>
                <li>Abrir el comprobante para ver las lineas de debito y credito</li>
                <li>Verificar que los montos coincidan con lo creado desde Atelier</li>
              </ol>
            </div>

            <Note>
              <strong>Batching:</strong> Si seleccionas mas de 50 productos, Atelier crea multiples
              comprobantes automaticamente (uno por cada lote de 50). Cada uno aparece como un
              documento separado en Siigo.
            </Note>

            <Note>
              <strong>Advertencia:</strong> Los comprobantes quedan registrados <strong>permanentemente</strong> en
              Siigo. Verificar montos antes de confirmar. Si hay un error, se debe crear una
              nota de ajuste directamente en Siigo Nube.
            </Note>
          </div>
        </Section>

        {/* Section 12: Analizar Costos y Margenes Reales */}
        <Section title="Analizar Costos y Margenes Reales" icon={DollarSign}>
          <div className="space-y-3">
            <Workflow
              siigo={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Exportar facturas de venta a Excel</li>
                  <li>Exportar facturas de compra a Excel</li>
                  <li>Exportar comprobantes de costeo a Excel</li>
                  <li>Cruzar ventas con compras del mes siguiente (consignacion)</li>
                  <li>Hacer match manual por proveedor y producto</li>
                  <li>Calcular margen por producto en la hoja de calculo</li>
                  <li><strong>Proceso de horas, cada mes</strong></li>
                </ol>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Costos Reales</strong> en el menu lateral</li>
                  <li>El sistema cruza automaticamente:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Ventas (facturas) con compras (facturas de compra)</li>
                      <li>Match por proveedor y codigo de producto</li>
                      <li>Comprobantes de costeo ya creados</li>
                    </ul>
                  </li>
                  <li>Ver por cada producto y mes: costo real, costo journal, margen</li>
                  <li>Seleccionar productos sin costo y crear comprobante directo</li>
                </ol>
              }
            />
            <Note>
              <strong>Prioridad de costos:</strong> El sistema usa primero el costo de la factura de
              compra (real). Si no hay compra, usa el costo del comprobante (journal). Si tampoco
              hay, estima al 70% del precio de venta.
            </Note>
          </div>
        </Section>

        {/* Section 13: Sincronizacion */}
        <Section title="Sincronizar Datos" icon={RefreshCw}>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Antes de usar los dashboards, es necesario sincronizar los datos desde Siigo.
              Esto descarga toda la informacion y la guarda localmente para consulta rapida.
            </p>
            <Workflow
              siigo={
                <p>No aplica — en Siigo Nube los datos estan siempre disponibles pero solo
                se pueden consultar uno por uno, sin cruces automaticos.</p>
              }
              atelier={
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click en <strong>Sincronizacion</strong> en el menu lateral</li>
                  <li>Click en el boton de sincronizar</li>
                  <li>Esperar a que complete (puede tardar varios minutos)</li>
                  <li>Ver conteo de registros sincronizados</li>
                </ol>
              }
            />
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Que se descarga de Siigo</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Facturas de venta + items</li>
                <li>Notas credito + items</li>
                <li>Facturas de compra + items</li>
                <li>Productos (catalogo completo)</li>
                <li>Clientes/terceros</li>
                <li>Comprobantes contables (journals) + movimientos</li>
                <li>Recibos de caja (vouchers)</li>
              </ul>
            </div>
            <Note>
              <strong>Solo lectura:</strong> La sincronizacion NO modifica nada en Siigo. Solo copia
              los datos para que Atelier pueda calcular reportes sin consultar Siigo cada vez.
            </Note>
          </div>
        </Section>

        {/* Section 14: Referencia de Cuentas */}
        <Section title="Referencia: Cuentas Contables (PUC)" icon={Calculator}>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Cuentas del Plan Unico de Cuentas colombiano que usa el sistema. En Siigo Nube se
              pueden consultar en <strong>Configuracion</strong> &rarr; <strong>Contabilidad</strong> &rarr; <strong>Plan de Cuentas</strong>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 border-b border-gray-200 font-medium text-gray-600">Codigo</th>
                    <th className="text-left px-3 py-2 border-b border-gray-200 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-3 py-2 border-b border-gray-200 font-medium text-gray-600">Que hace en Atelier</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 border-b border-gray-100"><Code>61350501</Code></td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Costo de Ventas — Comercio al por menor</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Se usa como <strong>DEBITO</strong> al crear comprobante de costeo</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 border-b border-gray-100"><Code>14350101</Code></td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Mercancias no fabricadas por la empresa</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Se usa como <strong>CREDITO</strong> al crear comprobante (reduce inventario)</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 border-b border-gray-100"><Code>2408</Code></td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">IVA por pagar</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Se usa para calcular el IVA neto en el dashboard</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 border-b border-gray-100"><Code>51xx</Code></td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Gastos de Administracion</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Aparecen como gastos admin en el Resumen (P&L)</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 border-b border-gray-100"><Code>52xx</Code></td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Gastos de Ventas</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Aparecen como gastos de venta en el Resumen (P&L)</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2 border-b border-gray-100"><Code>53xx</Code></td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Gastos Financieros</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-700">Aparecen como gastos financieros en el Resumen (P&L)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Note>
              En Siigo Nube puedes ver estas cuentas en <strong>Configuracion</strong> &rarr; <strong>Contabilidad</strong> &rarr; <strong>Plan
              de Cuentas</strong>. El PUC es el estandar regulado por la DIAN para todas las empresas colombianas.
            </Note>
          </div>
        </Section>

        {/* Section 15: Flujo de Datos */}
        <Section title="Referencia: Flujo de Datos" icon={Database}>
          <div className="space-y-4 text-sm text-gray-700">
            <div className="bg-gray-50 border border-gray-200 rounded p-4 font-mono text-xs leading-relaxed">
              <div className="text-center space-y-2">
                <div>
                  <span className="text-blue-600 font-bold">SIIGO NUBE</span>
                  <span className="text-gray-400"> (fuente de verdad)</span>
                </div>
                <div className="text-gray-400">&darr; Sincronizacion (solo lectura) &darr;</div>
                <div>
                  <span className="text-green-600 font-bold">BASE DE DATOS LOCAL</span>
                  <span className="text-gray-400"> (copia para consulta rapida)</span>
                </div>
                <div className="text-gray-400">&darr; Calculos automaticos &darr;</div>
                <div>
                  <span className="text-amber-600 font-bold">DASHBOARDS DE ATELIER</span>
                  <span className="text-gray-400"> (Resumen, Ventas, IVA, Costos...)</span>
                </div>
              </div>
              <div className="border-t border-gray-300 mt-4 pt-4 text-center space-y-2">
                <div>
                  <span className="text-amber-600 font-bold">CREAR COMPROBANTE</span>
                  <span className="text-gray-400"> (unica escritura)</span>
                </div>
                <div className="text-red-400">&uarr; Se envia a Siigo &uarr;</div>
                <div>
                  <span className="text-blue-600 font-bold">SIIGO NUBE</span>
                  <span className="text-gray-400"> (queda registrado permanentemente)</span>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
