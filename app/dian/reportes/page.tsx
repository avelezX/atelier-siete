'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Percent, Scale, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MonthlyRow {
  month: string;
  compras: number;
  ventas: number;
  ivaDescontable: number;
  ivaGenerado: number;
  countCompras: number;
  countVentas: number;
}

interface ReportData {
  totalCompras: number;
  totalVentas: number;
  ivaDescontable: number;
  ivaGenerado: number;
  utilidad: number;
  monthly: MonthlyRow[];
}

const MONTHS_LABELS: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function DianReportesPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState<string>('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      // Build date range
      let dateStart: string, dateEnd: string;
      if (month) {
        const lastDay = new Date(year, parseInt(month), 0).getDate();
        dateStart = `${year}-${month}-01`;
        dateEnd = `${year}-${month}-${lastDay}`;
      } else {
        dateStart = `${year}-01-01`;
        dateEnd = `${year}-12-31`;
      }

      const params = new URLSearchParams({ date_start: dateStart, date_end: dateEnd });

      // Fetch compras and ventas in parallel
      const [resCompras, resVentas] = await Promise.all([
        fetch(`/api/dian?group=Recibido&${params}`),
        fetch(`/api/dian?group=Emitido&${params}`),
      ]);

      const [dataCompras, dataVentas] = await Promise.all([
        resCompras.json(),
        resVentas.json(),
      ]);

      const compras: any[] = dataCompras.documents || [];
      const ventas: any[] = dataVentas.documents || [];

      // Aggregate monthly
      const monthlyMap: Record<string, MonthlyRow> = {};

      for (const doc of compras) {
        const m = (doc.issue_date || '').substring(0, 7);
        if (!m) continue;
        if (!monthlyMap[m]) monthlyMap[m] = { month: m, compras: 0, ventas: 0, ivaDescontable: 0, ivaGenerado: 0, countCompras: 0, countVentas: 0 };
        monthlyMap[m].compras += doc.amount || 0;
        monthlyMap[m].ivaDescontable += doc.tax_amount || 0;
        monthlyMap[m].countCompras++;
      }
      for (const doc of ventas) {
        const m = (doc.issue_date || '').substring(0, 7);
        if (!m) continue;
        if (!monthlyMap[m]) monthlyMap[m] = { month: m, compras: 0, ventas: 0, ivaDescontable: 0, ivaGenerado: 0, countCompras: 0, countVentas: 0 };
        monthlyMap[m].ventas += doc.amount || 0;
        monthlyMap[m].ivaGenerado += doc.tax_amount || 0;
        monthlyMap[m].countVentas++;
      }

      const totalCompras = compras.reduce((s, d) => s + (d.amount || 0), 0);
      const totalVentas = ventas.reduce((s, d) => s + (d.amount || 0), 0);
      const ivaDescontable = compras.reduce((s, d) => s + (d.tax_amount || 0), 0);
      const ivaGenerado = ventas.reduce((s, d) => s + (d.tax_amount || 0), 0);

      setData({
        totalCompras,
        totalVentas,
        ivaDescontable,
        ivaGenerado,
        utilidad: totalVentas - totalCompras,
        monthly: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [year, month]);

  function monthLabel(m: string) {
    const [y, mon] = m.split('-');
    return `${MONTHS_LABELS[mon] || mon} ${y}`;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reportes DIAN</h1>
            <p className="text-gray-500">Compras vs Ventas · IVA · Comparación mensual</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          >
            <option value="">Todo el año</option>
            {Object.entries(MONTHS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
        </div>
      ) : data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500 uppercase">Compras</p>
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-xl font-bold text-red-600">{formatCurrency(data.totalCompras)}</p>
              <p className="text-xs text-gray-400">Recibidas DIAN</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500 uppercase">Ventas</p>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xl font-bold text-green-600">{formatCurrency(data.totalVentas)}</p>
              <p className="text-xs text-gray-400">Emitidas DIAN</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500 uppercase">IVA Desc.</p>
                <Percent className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(data.ivaDescontable)}</p>
              <p className="text-xs text-gray-400">De compras</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500 uppercase">IVA Gen.</p>
                <Percent className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(data.ivaGenerado)}</p>
              <p className="text-xs text-gray-400">De ventas</p>
            </div>

            <div className={`rounded-xl border-2 p-5 ${data.utilidad >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500 uppercase">Utilidad</p>
                <Scale className={`w-4 h-4 ${data.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <p className={`text-xl font-bold ${data.utilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(data.utilidad)}
              </p>
              <p className="text-xs text-gray-400">Ventas − Compras</p>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Comparación Mensual</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mes</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Compras</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventas</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">IVA Desc.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">IVA Gen.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Utilidad</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase"># C</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase"># V</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.monthly.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-gray-500">
                        No hay datos para este período
                      </td>
                    </tr>
                  ) : (
                    data.monthly.map((m) => {
                      const util = m.ventas - m.compras;
                      return (
                        <tr key={m.month} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{monthLabel(m.month)}</td>
                          <td className="px-5 py-3 text-sm text-right text-red-600 font-semibold">{formatCurrency(m.compras)}</td>
                          <td className="px-5 py-3 text-sm text-right text-green-600 font-semibold">{formatCurrency(m.ventas)}</td>
                          <td className="px-5 py-3 text-sm text-right text-orange-600">{formatCurrency(m.ivaDescontable)}</td>
                          <td className="px-5 py-3 text-sm text-right text-amber-600">{formatCurrency(m.ivaGenerado)}</td>
                          <td className={`px-5 py-3 text-sm text-right font-bold ${util >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(util)}
                          </td>
                          <td className="px-5 py-3 text-sm text-right text-gray-500">{m.countCompras}</td>
                          <td className="px-5 py-3 text-sm text-right text-gray-500">{m.countVentas}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {data.monthly.length > 1 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                    <tr>
                      <td className="px-5 py-3 text-sm text-gray-900">Total período</td>
                      <td className="px-5 py-3 text-sm text-right text-red-600">{formatCurrency(data.totalCompras)}</td>
                      <td className="px-5 py-3 text-sm text-right text-green-600">{formatCurrency(data.totalVentas)}</td>
                      <td className="px-5 py-3 text-sm text-right text-orange-600">{formatCurrency(data.ivaDescontable)}</td>
                      <td className="px-5 py-3 text-sm text-right text-amber-600">{formatCurrency(data.ivaGenerado)}</td>
                      <td className={`px-5 py-3 text-sm text-right ${data.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data.utilidad)}
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-gray-500">
                        {data.monthly.reduce((s, m) => s + m.countCompras, 0)}
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-gray-500">
                        {data.monthly.reduce((s, m) => s + m.countVentas, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
