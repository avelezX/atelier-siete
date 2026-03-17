'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileMinus2, RefreshCw, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { formatCurrency, formatDateShort } from '@/lib/utils';

// ── Emitidas (from Siigo) ─────────────────────────────────────────────────────
interface CreditNote {
  id: string;
  name: string;
  date: string;
  customer: { name?: string[]; identification: string };
  invoice?: { name: string };
  total: number;
}

type Tab = 'Emitidas' | 'Recibidas';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function CreditNotesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Emitidas');

  // Shared filters
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState<number | null>(new Date().getMonth() + 1);

  const [allNotes, setAllNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getDateRange() {
    if (month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      return { date_start: start, date_end: end };
    }
    return { date_start: `${year}-01-01`, date_end: `${year}-12-31` };
  }

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { date_start, date_end } = getDateRange();
      const res = await fetch(`/api/siigo/credit-notes?date_start=${date_start}&date_end=${date_end}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAllNotes(data.results || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadNotes(); }, [year, month]);

  // Emitidas = tienen referencia a una factura original (crédito sobre venta)
  // Recibidas = no tienen invoice (crédito recibido de proveedor)
  const emitidas = allNotes.filter(n => !!n.invoice);
  const recibidas = allNotes.filter(n => !n.invoice);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <FileMinus2 className="w-7 h-7 text-amber-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notas Crédito</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {activeTab === 'Emitidas'
                  ? `${emitidas.length} notas emitidas`
                  : `${recibidas.length} notas crédito recibidas`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={month ?? ''}
              onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">Todo el año</option>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <button
              onClick={loadNotes}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex space-x-0">
          <button
            onClick={() => setActiveTab('Emitidas')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'Emitidas'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Emitidas</span>
          </button>
          <button
            onClick={() => setActiveTab('Recibidas')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'Recibidas'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Recibidas</span>
          </button>
        </div>
      </div>

      <div className="px-8 py-6">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Emitidas table */}
        {activeTab === 'Emitidas' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Factura Original</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" /></div>
                  </td></tr>
                ) : emitidas.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                    <FileMinus2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No hay notas crédito emitidas en este período</p>
                  </td></tr>
                ) : (
                  emitidas.map((note) => (
                    <tr key={note.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-amber-700 font-medium">{note.name}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateShort(note.date)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {note.customer?.name?.join(' ') || note.customer?.identification || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{note.invoice?.name || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(note.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {emitidas.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-xs text-gray-500 uppercase">
                      Total ({emitidas.length} notas)
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      {formatCurrency(emitidas.reduce((s, n) => s + (n.total || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Recibidas table */}
        {activeTab === 'Recibidas' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">NIT</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" /></div>
                  </td></tr>
                ) : recibidas.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                    <FileMinus2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No hay notas crédito recibidas en este período</p>
                    <p className="text-xs mt-1">Sincroniza desde <strong>DIAN → Facturas → Notas Crédito</strong></p>
                  </td></tr>
                ) : (
                  recibidas.map((note) => (
                    <tr key={note.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-teal-700 font-medium">{note.name}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateShort(note.date)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {note.customer?.name?.join(' ') || note.customer?.identification || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{note.customer?.identification || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(note.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {recibidas.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-xs text-gray-500 uppercase">
                      Total ({recibidas.length} notas)
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      {formatCurrency(recibidas.reduce((s, n) => s + (n.total || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
