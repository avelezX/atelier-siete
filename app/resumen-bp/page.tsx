'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Shield,
  MessageSquare,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SubcatItem {
  code: string;
  name: string;
  net: number;
}

interface MonthPyG {
  month: string;
  ventas_brutas: number;
  devoluciones: number;
  ventas_netas: number;
  otros_ingresos: number;
  costo_ventas: number;
  utilidad_bruta: number;
  margen_bruto_pct: number;
  gastos_admin: number;
  gastos_venta: number;
  gastos_financieros: number;
  total_gastos: number;
  utilidad_operativa: number;
  subcats_51: SubcatItem[];
  subcats_52: SubcatItem[];
  subcats_53: SubcatItem[];
  subcats_61: SubcatItem[];
}

interface Totals {
  ventas_brutas: number;
  devoluciones: number;
  ventas_netas: number;
  otros_ingresos: number;
  costo_ventas: number;
  utilidad_bruta: number;
  margen_bruto_pct: number;
  gastos_admin: number;
  gastos_venta: number;
  gastos_financieros: number;
  total_gastos: number;
  utilidad_operativa: number;
}

interface AnnualVerification {
  annual_bp: Record<string, number>;
  monthly_sum: Record<string, number>;
  diff: Record<string, number>;
  account_counts: Record<string, { total: number; leaves: number }>;
}

interface ResumenBPData {
  year: number;
  source: string;
  errors?: string[];
  months: MonthPyG[];
  totals: Totals;
  subcats_totals: Record<string, SubcatItem[]>;
  annual_verification?: AnnualVerification;
}

interface BPNote {
  id: string;
  account_code: string;
  month: string;
  year: number;
  note: string;
  invoice_number: string | null;
  supplier: string | null;
  amount: number | null;
  created_at: string;
}

function monthLabel(yyyymm: string): string {
  if (yyyymm === 'TOTAL') return 'TOTAL';
  const m = parseInt(yyyymm.split('-')[1]);
  const short = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return short[m - 1] || yyyymm;
}

function pct(value: number, total: number): string {
  if (total === 0) return '0.0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

export default function ResumenBPPage() {
  const [data, setData] = useState<ResumenBPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [year] = useState(2025);

  // Notes state
  const [notes, setNotes] = useState<BPNote[]>([]);
  const [noteModal, setNoteModal] = useState<{ account_code: string; month: string; account_name: string } | null>(null);
  const [newNote, setNewNote] = useState({ note: '', invoice_number: '', supplier: '', amount: '' });
  const [savingNote, setSavingNote] = useState(false);

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Load notes
  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/bp-notes?year=${year}`);
      const json = await res.json();
      if (json.notes) setNotes(json.notes);
    } catch {
      // silently fail — notes are supplementary
    }
  }, [year]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/dashboard/resumen-bp?year=${year}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadData();
    loadNotes();
  }, [loadData, loadNotes]);

  // Notes helpers
  function getNotesForCell(account_code: string, month: string): BPNote[] {
    return notes.filter(n => n.account_code === account_code && n.month === month);
  }

  function getNoteCountForCode(account_code: string): number {
    return notes.filter(n => n.account_code === account_code).length;
  }

  async function saveNote() {
    if (!noteModal || !newNote.note.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch('/api/bp-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_code: noteModal.account_code,
          month: noteModal.month,
          year,
          note: newNote.note.trim(),
          invoice_number: newNote.invoice_number.trim() || null,
          supplier: newNote.supplier.trim() || null,
          amount: newNote.amount ? parseFloat(newNote.amount) : null,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await loadNotes();
      setNewNote({ note: '', invoice_number: '', supplier: '', amount: '' });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error guardando nota');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(id: string) {
    try {
      await fetch(`/api/bp-notes?id=${id}`, { method: 'DELETE' });
      await loadNotes();
    } catch {
      // ignore
    }
  }

  const t = data?.totals;
  const months = data?.months || [];

  // Helper to get subcategory for a month
  function getMonthSubcats(m: MonthPyG, prefix: string): SubcatItem[] {
    const key = `subcats_${prefix}` as keyof MonthPyG;
    return (m[key] as SubcatItem[]) || [];
  }

  // Build subcategory row data across months
  function subcatRows(prefix: string): { code: string; name: string; byMonth: Record<string, number>; total: number }[] {
    const totalSubs = data?.subcats_totals[prefix] || [];
    return totalSubs.map((s) => {
      const byMonth: Record<string, number> = {};
      months.forEach((m) => {
        const sub = getMonthSubcats(m, prefix).find((x) => x.code === s.code);
        byMonth[m.month] = sub?.net || 0;
      });
      return { code: s.code, name: s.name, byMonth, total: s.net };
    });
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resumen Financiero</h1>
            <p className="text-gray-500 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              Fuente: Balance de Prueba Siigo — {year}
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Cargando...' : 'Actualizar'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {loading && !data ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Descargando Balance de Prueba de Siigo...</p>
          <p className="text-xs text-gray-400 mt-1">12 reportes mensuales (~30 segundos)</p>
        </div>
      ) : data && t ? (
        <>
          {/* Siigo warnings */}
          {data.errors && data.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              {data.errors.map((e, i) => <p key={i} className="text-xs text-amber-700">{e}</p>)}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs text-gray-500">Ventas Netas</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(t.ventas_netas)}</p>
              <p className="text-xs text-gray-400">Dev: {formatCurrency(t.devoluciones)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-xs text-gray-500">Costo de Ventas</p>
              </div>
              <p className="text-lg font-bold text-red-700">{formatCurrency(t.costo_ventas)}</p>
              <p className="text-xs text-gray-400">{pct(t.costo_ventas, t.ventas_netas)} de ventas</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${t.utilidad_bruta >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className={`w-4 h-4 ${t.utilidad_bruta >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <p className="text-xs text-gray-500">Utilidad Bruta</p>
              </div>
              <p className={`text-lg font-bold ${t.utilidad_bruta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(t.utilidad_bruta)}
              </p>
              <p className="text-xs text-gray-400">Margen: {t.margen_bruto_pct}%</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                <p className="text-xs text-gray-500">Gastos Operativos</p>
              </div>
              <p className="text-lg font-bold text-orange-700">{formatCurrency(t.total_gastos)}</p>
              <p className="text-xs text-gray-400">{pct(t.total_gastos, t.ventas_netas)} de ventas</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${t.utilidad_operativa >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className={`w-4 h-4 ${t.utilidad_operativa >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <p className="text-xs text-gray-500">Utilidad Operativa</p>
              </div>
              <p className={`text-lg font-bold ${t.utilidad_operativa >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(t.utilidad_operativa)}
              </p>
              <p className="text-xs text-gray-400">{pct(t.utilidad_operativa, t.ventas_netas)} de ventas</p>
            </div>
          </div>

          {/* Renta card */}
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 mb-1">Renta Estimada (35% sobre utilidad operativa)</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(Math.max(t.utilidad_operativa, 0) * 0.35)}
                </p>
              </div>
              <div className="text-right text-sm text-purple-700">
                <p>Base gravable: {formatCurrency(Math.max(t.utilidad_operativa, 0))}</p>
                <p>Tasa: 35%</p>
              </div>
            </div>
            <p className="text-xs text-purple-400 mt-2">
              * Estimacion simplificada. No incluye deducciones especiales, rentas exentas ni renta presuntiva.
            </p>
          </div>

          {/* Monthly P&L Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Estado de Resultados Mensual</h2>
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Balance de Prueba Siigo
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 min-w-[180px]">
                      Concepto
                    </th>
                    {months.map((m) => (
                      <th key={m.month} className="text-right px-3 py-3 text-xs font-semibold text-amber-700 uppercase whitespace-nowrap min-w-[110px]">
                        {monthLabel(m.month)}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-900 uppercase bg-gray-100 min-w-[120px]">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ventas Brutas */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">Ventas Brutas</td>
                    {months.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-gray-900">{formatCurrency(m.ventas_brutas)}</td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-gray-900 bg-gray-50">{formatCurrency(t.ventas_brutas)}</td>
                  </tr>

                  {/* Devoluciones */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">(-) Devoluciones / NC</td>
                    {months.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-red-600">
                        {m.devoluciones > 0 ? `-${formatCurrency(m.devoluciones)}` : formatCurrency(0)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-red-600 bg-gray-50">-{formatCurrency(t.devoluciones)}</td>
                  </tr>

                  {/* Ventas Netas */}
                  <tr className="border-b border-gray-200 bg-green-50 font-semibold">
                    <td className="px-4 py-2 text-green-800 sticky left-0 bg-green-50">= Ventas Netas</td>
                    {months.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-green-800">{formatCurrency(m.ventas_netas)}</td>
                    ))}
                    <td className="px-4 py-2 text-right text-green-900 bg-green-100">{formatCurrency(t.ventas_netas)}</td>
                  </tr>

                  {/* Costo de Ventas */}
                  {renderExpandableRow('costo_ventas', '(-) Costo de Ventas', 'red', (m) => m.costo_ventas, t.costo_ventas, '61')}

                  {/* Utilidad Bruta */}
                  <tr className="border-b border-gray-200 bg-blue-50 font-semibold">
                    <td className="px-4 py-2 text-blue-800 sticky left-0 bg-blue-50">= Utilidad Bruta</td>
                    {months.map((m) => (
                      <td key={m.month} className={`px-3 py-2 text-right ${m.utilidad_bruta >= 0 ? 'text-blue-800' : 'text-red-700'}`}>
                        {formatCurrency(m.utilidad_bruta)}
                      </td>
                    ))}
                    <td className={`px-4 py-2 text-right bg-blue-100 ${t.utilidad_bruta >= 0 ? 'text-blue-900' : 'text-red-700'}`}>
                      {formatCurrency(t.utilidad_bruta)}
                    </td>
                  </tr>

                  {/* Margen Bruto */}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 italic sticky left-0 bg-white text-xs">Margen Bruto %</td>
                    {months.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-gray-500 text-xs">{m.margen_bruto_pct}%</td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-gray-600 bg-gray-50 text-xs">{t.margen_bruto_pct}%</td>
                  </tr>

                  {/* Gastos Admin */}
                  {renderExpandableRow('gastos_admin', '(-) Gastos Admin', 'orange', (m) => m.gastos_admin, t.gastos_admin, '51')}

                  {/* Gastos Venta */}
                  {renderExpandableRow('gastos_venta', '(-) Gastos de Venta', 'orange', (m) => m.gastos_venta, t.gastos_venta, '52')}

                  {/* Gastos Financieros */}
                  {renderExpandableRow('gastos_financieros', '(-) Gastos Financieros', 'purple', (m) => m.gastos_financieros, t.gastos_financieros, '53')}

                  {/* Total Gastos */}
                  <tr className="border-b border-gray-200 bg-orange-50 font-semibold">
                    <td className="px-4 py-2 text-orange-800 sticky left-0 bg-orange-50">= Total Gastos</td>
                    {months.map((m) => (
                      <td key={m.month} className="px-3 py-2 text-right text-orange-800">{formatCurrency(m.total_gastos)}</td>
                    ))}
                    <td className="px-4 py-2 text-right text-orange-900 bg-orange-100">{formatCurrency(t.total_gastos)}</td>
                  </tr>

                  {/* Utilidad Operativa */}
                  <tr className="border-b border-gray-200 bg-amber-50 font-bold text-base">
                    <td className="px-4 py-3 text-amber-900 sticky left-0 bg-amber-50">= Utilidad Operativa</td>
                    {months.map((m) => (
                      <td key={m.month} className={`px-3 py-3 text-right ${m.utilidad_operativa >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                        {formatCurrency(m.utilidad_operativa)}
                      </td>
                    ))}
                    <td className={`px-4 py-3 text-right bg-amber-100 ${t.utilidad_operativa >= 0 ? 'text-green-900' : 'text-red-700'}`}>
                      {formatCurrency(t.utilidad_operativa)}
                    </td>
                  </tr>

                  {/* Otros Ingresos (if any) */}
                  {t.otros_ingresos !== 0 && (
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 sticky left-0 bg-white text-xs">Otros Ingresos (42)</td>
                      {months.map((m) => (
                        <td key={m.month} className="px-3 py-2 text-right text-gray-500 text-xs">
                          {m.otros_ingresos !== 0 ? formatCurrency(m.otros_ingresos) : '-'}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold text-gray-600 bg-gray-50 text-xs">
                        {formatCurrency(t.otros_ingresos)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes Section */}
          {notes.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden mb-6">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-700" />
                <h2 className="text-sm font-semibold text-amber-900">Notas Contables</h2>
                <span className="text-xs text-amber-600 ml-auto">{notes.length} nota{notes.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {notes.map((n) => (
                  <div key={n.id} className="px-4 py-3 hover:bg-gray-50 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{n.account_code}</span>
                          <span className="text-xs text-amber-700 font-medium">{monthLabel(n.month)}</span>
                          {n.invoice_number && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                              {n.invoice_number}
                            </span>
                          )}
                          {n.supplier && (
                            <span className="text-xs text-gray-500">{n.supplier}</span>
                          )}
                          {n.amount && (
                            <span className="text-xs font-medium text-gray-700">{formatCurrency(n.amount)}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{n.note}</p>
                      </div>
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                        title="Eliminar nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Annual Verification */}
          {data.annual_verification && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-700">
                  Verificacion: Suma Mensual vs Balance de Prueba Anual
                </h2>
                <p className="text-xs text-gray-400">
                  Compara la suma de 12 reportes mensuales contra un solo reporte anual (Ene-Dic)
                </p>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                        <th className="text-left px-3 py-2">Concepto</th>
                        <th className="text-right px-3 py-2">Suma Mensual</th>
                        <th className="text-right px-3 py-2">BP Anual</th>
                        <th className="text-right px-3 py-2">Diferencia</th>
                        <th className="text-center px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'ventas_brutas', label: 'Ventas Brutas (41 Cr)' },
                        { key: 'devoluciones', label: 'Devoluciones (41 Db)' },
                        { key: 'ventas_netas', label: 'Ventas Netas' },
                        { key: 'costo_ventas', label: 'Costo de Ventas (61)' },
                        { key: 'gastos_admin', label: 'Gastos Admin (51)' },
                        { key: 'gastos_venta', label: 'Gastos Venta (52)' },
                        { key: 'gastos_financieros', label: 'Gastos Financieros (53)' },
                        { key: 'utilidad_operativa', label: 'Utilidad Operativa' },
                      ].map(({ key, label }) => {
                        const monthly = data.annual_verification!.monthly_sum[key] || 0;
                        const annual = data.annual_verification!.annual_bp[key] || 0;
                        const diff = data.annual_verification!.diff[key] || 0;
                        const pctDiff = annual !== 0 ? Math.abs(diff / annual) * 100 : 0;
                        const isOk = pctDiff < 1;
                        return (
                          <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700">{label}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(monthly)}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(annual)}</td>
                            <td className={`px-3 py-2 text-right font-mono ${isOk ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isOk ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                  {pctDiff.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Account counts */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Cuentas en BP anual (total / hojas):</p>
                  <div className="flex gap-4 text-xs">
                    {Object.entries(data.annual_verification.account_counts).map(([prefix, counts]) => (
                      <span key={prefix} className="bg-gray-100 px-2 py-1 rounded font-mono">
                        {prefix}: {counts.total} total, {counts.leaves} hojas
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Source note */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-bold text-green-900">Fuente: Balance de Prueba Oficial</h3>
            </div>
            <p className="text-xs text-green-800 leading-relaxed">
              Estos datos provienen directamente del Balance de Prueba de Siigo, que incluye
              <strong> todos los tipos de documento</strong> (CC, FC, FV, RC, CE, NC, ND).
              Los numeros reflejan la contabilidad oficial de la empresa y son identicos
              a lo que aparece en los reportes de Siigo.
            </p>
          </div>
        </>
      ) : null}

      {/* Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setNoteModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Nota Contable</h3>
                <p className="text-xs text-gray-500">
                  <span className="font-mono">{noteModal.account_code}</span> — {noteModal.account_name} — {monthLabel(noteModal.month)}
                </p>
              </div>
              <button onClick={() => setNoteModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Existing notes for this cell */}
              {getNotesForCell(noteModal.account_code, noteModal.month).length > 0 && (
                <div className="space-y-2">
                  {getNotesForCell(noteModal.account_code, noteModal.month).map((n) => (
                    <div key={n.id} className="bg-gray-50 rounded-lg p-3 text-sm group relative">
                      <div className="flex items-center gap-2 mb-1">
                        {n.invoice_number && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                            {n.invoice_number}
                          </span>
                        )}
                        {n.supplier && <span className="text-xs text-gray-500">{n.supplier}</span>}
                        {n.amount && <span className="text-xs font-medium text-gray-700">{formatCurrency(n.amount)}</span>}
                      </div>
                      <p className="text-gray-700">{n.note}</p>
                      <button
                        onClick={() => deleteNote(n.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New note form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">No. Factura</label>
                    <input
                      type="text"
                      value={newNote.invoice_number}
                      onChange={(e) => setNewNote((p) => ({ ...p, invoice_number: e.target.value }))}
                      placeholder="FC-1-838"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Proveedor</label>
                    <input
                      type="text"
                      value={newNote.supplier}
                      onChange={(e) => setNewNote((p) => ({ ...p, supplier: e.target.value }))}
                      placeholder="MALMO S.A.S"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Monto</label>
                  <input
                    type="text"
                    value={newNote.amount}
                    onChange={(e) => setNewNote((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="5407500"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nota</label>
                  <textarea
                    value={newNote.note}
                    onChange={(e) => setNewNote((p) => ({ ...p, note: e.target.value }))}
                    placeholder="Remodelacion local..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>
                <button
                  onClick={saveNote}
                  disabled={savingNote || !newNote.note.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {savingNote ? 'Guardando...' : 'Agregar Nota'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper to render expandable rows with subcategory detail
  function renderExpandableRow(
    rowKey: string,
    label: string,
    color: string,
    getValue: (m: MonthPyG) => number,
    totalValue: number,
    subcatPrefix: string,
  ) {
    const isExpanded = expandedRows.has(rowKey);
    const colorClass = color === 'red' ? 'text-red-600' : color === 'purple' ? 'text-purple-600' : 'text-orange-600';
    const bgExpand = color === 'red' ? 'bg-red-50/20' : color === 'purple' ? 'bg-purple-50/20' : 'bg-orange-50/20';

    const subs = subcatRows(subcatPrefix);

    return (
      <>
        <tr
          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
          onClick={() => toggleRow(rowKey)}
        >
          <td className="px-4 py-2 text-gray-600 sticky left-0 bg-white">
            <span className="inline-flex items-center gap-1">
              {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
              {label}
            </span>
          </td>
          {months.map((m) => (
            <td key={m.month} className={`px-3 py-2 text-right ${colorClass}`}>
              {formatCurrency(getValue(m))}
            </td>
          ))}
          <td className={`px-4 py-2 text-right font-semibold ${colorClass} bg-gray-50`}>
            {formatCurrency(totalValue)}
          </td>
        </tr>
        {isExpanded && subs.map((sub) => {
          const noteCount = getNoteCountForCode(sub.code);
          return (
            <tr key={sub.code} className={`border-b border-gray-50 ${bgExpand}`}>
              <td className="pl-9 pr-4 py-1.5 text-xs text-gray-500 sticky left-0 truncate max-w-[180px]" title={`${sub.code} - ${sub.name}`}
                style={{ backgroundColor: 'inherit' }}
              >
                <span className="font-mono text-gray-400 mr-1">{sub.code}</span>
                {sub.name}
                {noteCount > 0 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600" title={`${noteCount} nota(s)`}>
                    <MessageSquare className="w-3 h-3" />
                    <span className="text-[10px]">{noteCount}</span>
                  </span>
                )}
              </td>
              {months.map((m) => {
                const val = sub.byMonth[m.month] || 0;
                const cellNotes = getNotesForCell(sub.code, m.month);
                return (
                  <td
                    key={m.month}
                    className={`px-3 py-1.5 text-right text-xs text-gray-500 relative group cursor-pointer hover:bg-amber-50/50`}
                    onClick={() => setNoteModal({ account_code: sub.code, month: m.month, account_name: sub.name })}
                  >
                    <span>{val !== 0 ? formatCurrency(val) : '-'}</span>
                    {cellNotes.length > 0 && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-400 rounded-full" title={`${cellNotes.length} nota(s)`} />
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-600 bg-gray-50/50">
                {formatCurrency(sub.total)}
              </td>
            </tr>
          );
        })}
      </>
    );
  }
}
