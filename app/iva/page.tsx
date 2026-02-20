'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MonthIva {
  month: string;
  month_label: string;
  iva_generado: number;
  base_ventas: number;
  invoices_count: number;
  iva_nc: number;
  base_nc: number;
  cn_count: number;
  iva_descontable: number;
  base_compras: number;
  purchases_count: number;
  iva_neto: number;
}

interface CuatrimestralPeriod {
  id: string;
  label: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  deadline: string;
  months: string[];
}

interface PeriodData {
  period: CuatrimestralPeriod;
  iva_generado: number;
  base_gravable_ventas: number;
  invoices_count: number;
  iva_notas_credito: number;
  base_nc: number;
  cn_count: number;
  iva_descontable: number;
  base_compras: number;
  purchases_count: number;
  iva_neto: number;
  is_past_due: boolean;
  is_current: boolean;
  monthly: MonthIva[];
}

interface AnnualData {
  iva_generado: number;
  base_gravable_ventas: number;
  invoices_count: number;
  iva_notas_credito: number;
  base_nc: number;
  cn_count: number;
  iva_descontable: number;
  base_compras: number;
  purchases_count: number;
  iva_neto: number;
}

interface IvaData {
  year: number;
  nit: string;
  razon_social: string;
  regimen: string;
  formulario: string;
  ultimo_digito_nit: number;
  periods: PeriodData[];
  annual: AnnualData;
  available_years: string[];
  validation: {
    tasa_iva_efectiva: number;
    nota: string;
  };
  fuentes: {
    descripcion: string;
    facturas_venta: number;
    notas_credito: number;
    facturas_compra: number;
  };
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function PeriodCard({ pd }: { pd: PeriodData }) {
  const [open, setOpen] = useState(false);
  const saldoFavor = pd.iva_neto < 0;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${
      pd.is_current ? 'border-amber-300 ring-2 ring-amber-100' :
      pd.is_past_due ? 'border-gray-200' : 'border-gray-200'
    }`}>
      {/* Period Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          <div className="text-left">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-900 text-lg">{pd.period.label}</span>
              {pd.is_current && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full">
                  ACTUAL
                </span>
              )}
              {pd.is_past_due && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded-full">
                  VENCIDO
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>Vence: {formatDate(pd.period.deadline)}</span>
              </span>
              <span>{pd.invoices_count} FV, {pd.cn_count} NC, {pd.purchases_count} FC</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase">
            {saldoFavor ? 'Saldo a Favor' : 'A Pagar DIAN'}
          </p>
          <p className={`text-xl font-bold ${
            saldoFavor ? 'text-green-700' : pd.iva_neto === 0 ? 'text-gray-500' : 'text-red-700'
          }`}>
            {formatCurrency(Math.abs(pd.iva_neto))}
          </p>
        </div>
      </button>

      {/* Period Detail */}
      {open && (
        <div className="border-t border-gray-100">
          {/* Formulario 300 breakdown */}
          <div className="px-5 py-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center space-x-1">
              <FileText className="w-3 h-3" />
              <span>Liquidacion Formulario 300</span>
            </h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase">
                  <th className="text-left py-1">Concepto</th>
                  <th className="text-right py-1">Base Gravable</th>
                  <th className="text-right py-1">Documentos</th>
                  <th className="text-right py-1 w-40">IVA</th>
                </tr>
              </thead>
              <tbody>
                {/* IVA Generado */}
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-800 font-medium">
                    IVA Generado — Facturas de Venta (FV)
                  </td>
                  <td className="py-2.5 text-right text-gray-600">
                    {formatCurrency(pd.base_gravable_ventas)}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    {pd.invoices_count} FV
                  </td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">
                    {formatCurrency(pd.iva_generado)}
                  </td>
                </tr>

                {/* IVA NC */}
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-600">
                    (-) IVA Notas Credito (NC)
                  </td>
                  <td className="py-2.5 text-right text-gray-500">
                    {formatCurrency(pd.base_nc)}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    {pd.cn_count} NC
                  </td>
                  <td className="py-2.5 text-right text-red-600">
                    -{formatCurrency(pd.iva_notas_credito)}
                  </td>
                </tr>

                {/* IVA Descontable */}
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-600">
                    (-) IVA Descontable — Facturas de Compra (FC)
                  </td>
                  <td className="py-2.5 text-right text-gray-500">
                    {formatCurrency(pd.base_compras)}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    {pd.purchases_count} FC
                  </td>
                  <td className="py-2.5 text-right text-blue-600">
                    -{formatCurrency(pd.iva_descontable)}
                  </td>
                </tr>

                {/* Separator */}
                <tr>
                  <td colSpan={4} className="py-1">
                    <div className="border-t-2 border-gray-300" />
                  </td>
                </tr>

                {/* IVA Neto */}
                <tr className={`font-bold ${saldoFavor ? 'text-green-800' : 'text-red-800'}`}>
                  <td className="py-2.5" colSpan={2}>
                    {saldoFavor ? '= Saldo a Favor del Periodo' : '= Saldo a Pagar DIAN'}
                  </td>
                  <td className="py-2.5 text-right text-xs font-normal text-gray-500">
                    F.300
                  </td>
                  <td className="py-2.5 text-right text-lg">
                    {formatCurrency(Math.abs(pd.iva_neto))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Monthly breakdown */}
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Desglose Mensual
            </h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase">
                  <th className="text-left py-1 px-2 font-medium">Mes</th>
                  <th className="text-right py-1 px-2 font-medium">Base Ventas</th>
                  <th className="text-right py-1 px-2 font-medium">IVA Generado</th>
                  <th className="text-right py-1 px-2 font-medium">IVA NC</th>
                  <th className="text-right py-1 px-2 font-medium">Base Compras</th>
                  <th className="text-right py-1 px-2 font-medium">IVA Descontable</th>
                  <th className="text-right py-1 px-2 font-medium">IVA Neto</th>
                  <th className="text-right py-1 px-2 font-medium">FV</th>
                  <th className="text-right py-1 px-2 font-medium">NC</th>
                  <th className="text-right py-1 px-2 font-medium">FC</th>
                </tr>
              </thead>
              <tbody>
                {pd.monthly.map((m) => (
                  <tr key={m.month} className="border-t border-gray-200">
                    <td className="py-1.5 px-2 font-medium text-gray-700">
                      {m.month_label}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-600">
                      {formatCurrency(m.base_ventas)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-900 font-medium">
                      {formatCurrency(m.iva_generado)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-red-600">
                      {m.iva_nc > 0 ? `-${formatCurrency(m.iva_nc)}` : '-'}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-600">
                      {formatCurrency(m.base_compras)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-blue-600">
                      {m.iva_descontable > 0 ? `-${formatCurrency(m.iva_descontable)}` : '-'}
                    </td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${m.iva_neto >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {formatCurrency(m.iva_neto)}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-400">{m.invoices_count}</td>
                    <td className="py-1.5 px-2 text-right text-gray-400">{m.cn_count}</td>
                    <td className="py-1.5 px-2 text-right text-gray-400">{m.purchases_count}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 font-semibold">
                  <td className="py-1.5 px-2 text-gray-900">TOTAL</td>
                  <td className="py-1.5 px-2 text-right text-gray-900">
                    {formatCurrency(pd.base_gravable_ventas)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-900">
                    {formatCurrency(pd.iva_generado)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-red-600">
                    {pd.iva_notas_credito > 0 ? `-${formatCurrency(pd.iva_notas_credito)}` : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-900">
                    {formatCurrency(pd.base_compras)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-blue-600">
                    -{formatCurrency(pd.iva_descontable)}
                  </td>
                  <td className={`py-1.5 px-2 text-right ${pd.iva_neto >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {formatCurrency(pd.iva_neto)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-500">{pd.invoices_count}</td>
                  <td className="py-1.5 px-2 text-right text-gray-500">{pd.cn_count}</td>
                  <td className="py-1.5 px-2 text-right text-gray-500">{pd.purchases_count}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IvaPage() {
  const [data, setData] = useState<IvaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear() - 1));

  const loadData = useCallback(async (year?: string) => {
    setLoading(true);
    setError('');
    try {
      const params = year ? `?year=${year}` : '';
      const res = await fetch(`/api/dashboard/iva${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedYear);
  }, [loadData, selectedYear]);

  const a = data?.annual;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Receipt className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Declaracion de IVA</h1>
            <p className="text-gray-500">
              Formulario 300 DIAN — Regimen Cuatrimestral
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            disabled={loading}
            aria-label="Ano gravable"
          >
            {(data?.available_years || [selectedYear]).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadData(selectedYear)}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="text-center py-12 text-gray-500">Cargando datos de IVA...</div>
      ) : data && a ? (
        <>
          {/* NIT & Regime info */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <div>
                  <span className="text-gray-500">NIT:</span>{' '}
                  <span className="font-semibold text-gray-900">{data.nit}-{data.ultimo_digito_nit}</span>
                </div>
                <div>
                  <span className="text-gray-500">Razon Social:</span>{' '}
                  <span className="font-semibold text-gray-900">{data.razon_social}</span>
                </div>
                <div>
                  <span className="text-gray-500">Periodo:</span>{' '}
                  <span className="font-semibold text-gray-900">{data.regimen}</span>
                </div>
                <div>
                  <span className="text-gray-500">Formulario:</span>{' '}
                  <span className="font-semibold text-gray-900">{data.formulario}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {a.iva_neto >= 0 ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                <span className={`font-semibold ${a.iva_neto >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                  Total {data.year}: {formatCurrency(Math.abs(a.iva_neto))} {a.iva_neto >= 0 ? 'a pagar' : 'a favor'}
                </span>
              </div>
            </div>
          </div>

          {/* Annual Summary — Formulario 300 style */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Resumen Anual {data.year} — Formulario 300
              </h2>
              <span className="text-xs text-gray-400">
                Tasa IVA efectiva: {data.validation.tasa_iva_efectiva}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[250px]">
                      Concepto
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[130px]">
                      Base Gravable
                    </th>
                    {data.periods.map((pd) => (
                      <th key={pd.period.id} className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap min-w-[120px]">
                        {pd.period.label.split(' ').slice(0, 3).join(' ')}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-900 uppercase bg-gray-100 min-w-[120px]">
                      TOTAL {data.year}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* IVA Generado */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      IVA Generado — Facturas de Venta
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {formatCurrency(a.base_gravable_ventas)}
                    </td>
                    {data.periods.map((pd) => (
                      <td key={pd.period.id} className="px-3 py-2.5 text-right text-gray-900">
                        {formatCurrency(pd.iva_generado)}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 bg-gray-50">
                      {formatCurrency(a.iva_generado)}
                    </td>
                  </tr>

                  {/* NC */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">
                      (-) IVA Notas Credito
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500">
                      {formatCurrency(a.base_nc)}
                    </td>
                    {data.periods.map((pd) => (
                      <td key={pd.period.id} className="px-3 py-2.5 text-right text-red-600">
                        {pd.iva_notas_credito > 0 ? `-${formatCurrency(pd.iva_notas_credito)}` : '-'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-semibold text-red-600 bg-gray-50">
                      -{formatCurrency(a.iva_notas_credito)}
                    </td>
                  </tr>

                  {/* Descontable */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">
                      (-) IVA Descontable — Facturas de Compra
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500">
                      {formatCurrency(a.base_compras)}
                    </td>
                    {data.periods.map((pd) => (
                      <td key={pd.period.id} className="px-3 py-2.5 text-right text-blue-600">
                        {pd.iva_descontable > 0 ? `-${formatCurrency(pd.iva_descontable)}` : '-'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-semibold text-blue-600 bg-gray-50">
                      -{formatCurrency(a.iva_descontable)}
                    </td>
                  </tr>

                  {/* IVA Neto */}
                  <tr className={`font-bold ${a.iva_neto >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <td className={`px-4 py-3 ${a.iva_neto >= 0 ? 'text-red-800' : 'text-green-800'}`} colSpan={2}>
                      = {a.iva_neto >= 0 ? 'Total IVA a Pagar DIAN' : 'Saldo a Favor'}
                    </td>
                    {data.periods.map((pd) => (
                      <td key={pd.period.id} className={`px-3 py-3 text-right ${pd.iva_neto >= 0 ? 'text-red-800' : 'text-green-800'}`}>
                        {formatCurrency(pd.iva_neto)}
                      </td>
                    ))}
                    <td className={`px-4 py-3 text-right text-lg ${a.iva_neto >= 0 ? 'text-red-900 bg-red-100' : 'text-green-900 bg-green-100'}`}>
                      {formatCurrency(a.iva_neto)}
                    </td>
                  </tr>

                  {/* Document counts */}
                  <tr className="border-t border-gray-200 text-xs text-gray-400">
                    <td className="px-4 py-2 italic" colSpan={2}>Documentos</td>
                    {data.periods.map((pd) => (
                      <td key={pd.period.id} className="px-3 py-2 text-right">
                        {pd.invoices_count} FV, {pd.cn_count} NC, {pd.purchases_count} FC
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right bg-gray-50">
                      {a.invoices_count} FV, {a.cn_count} NC, {a.purchases_count} FC
                    </td>
                  </tr>

                  {/* Deadlines */}
                  <tr className="border-t border-gray-100 text-xs">
                    <td className="px-4 py-2 text-gray-400 italic" colSpan={2}>
                      Vencimiento (NIT digito {data.ultimo_digito_nit})
                    </td>
                    {data.periods.map((pd) => (
                      <td key={pd.period.id} className="px-3 py-2 text-right">
                        <span className={`flex items-center justify-end space-x-1 ${pd.is_past_due ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {pd.is_past_due ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span>{formatDate(pd.period.deadline)}</span>
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right text-gray-400 bg-gray-50">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Period Cards with detail */}
          <div className="space-y-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase">
              Detalle por Periodo
            </h2>
            {data.periods.map((pd) => (
              <PeriodCard key={pd.period.id} pd={pd} />
            ))}
          </div>

          {/* Methodology notes */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Metodologia de Calculo</h3>
            <div className="text-xs text-blue-700 space-y-1.5">
              <p><strong>Solo documentos electronicos DIAN:</strong> Este calculo usa exclusivamente facturas electronicas de venta (FV), notas credito electronicas (NC) y facturas electronicas de compra (FC) registradas en Siigo. No se usan comprobantes contables para evitar doble conteo.</p>
              <p><strong>IVA Generado:</strong> Campo tax_amount de cada factura de venta no anulada. Estas facturas son enviadas a la DIAN al momento de expedirse.</p>
              <p><strong>IVA Notas Credito:</strong> Campo tax_amount de notas credito. Reduce el IVA generado del periodo en que se expide la NC.</p>
              <p><strong>IVA Descontable:</strong> Campo tax_amount del encabezado de cada factura de compra. Representa el IVA pagado a proveedores en compras necesarias para la operacion (arrendamiento, servicios, mercancia, etc.).</p>
              <p><strong>Retenciones de IVA:</strong> No incluidas en este calculo. Si clientes grandes contribuyentes retuvieron IVA a Atelier, eso reduciria el valor a pagar. Consultar con el contador.</p>
              <p><strong>Vencimientos:</strong> Calendario tributario DIAN para NIT {data.nit} (ultimo digito {data.ultimo_digito_nit}), regimen cuatrimestral.</p>
              <p className="mt-2 text-blue-600 font-medium">* Este calculo es una estimacion. La declaracion oficial debe ser preparada por un contador publico.</p>
            </div>
          </div>

          {/* Validation */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4">
            <p className="text-xs text-gray-500">
              <strong>Validacion:</strong> {data.validation.nota}
            </p>
          </div>

          {/* Data source info */}
          <p className="text-xs text-gray-400">
            Fuentes ({data.fuentes.descripcion}): {data.fuentes.facturas_venta} facturas de venta,{' '}
            {data.fuentes.notas_credito} notas credito, {data.fuentes.facturas_compra} facturas de compra.
          </p>
        </>
      ) : null}
    </div>
  );
}
