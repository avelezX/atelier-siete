'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { FileText, Search, TrendingUp, ChevronDown, ChevronUp, X, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CheckCircle2, Clock, Loader2, AlertCircle, Ban, GitMerge } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DianDocument {
  id: string;
  cufe: string;
  number: string;
  prefix: string | null;
  document_type: string;
  document_group: string | null;
  issue_date: string;
  reception_date: string | null;
  issuer_nit: string;
  issuer_name: string;
  receiver_nit: string;
  receiver_name: string;
  amount: number;
  tax_amount: number;
  currency: string;
  status: string | null;
  metadata: any;
  created_at: string;
  siigo_purchase_id?: string | null;
  siigo_synced_at?: string | null;
}

interface Summary {
  total: number;
  totalAmount: number;
  totalIva: number;
}

interface SyncResult {
  created: number;
  total: number;
  errors: Array<{ folio: string; issuer: string; error: string; accountCode?: string }>;
  message?: string;
}

type Tab = 'Recibido' | 'Emitido';
type SiigoStatus = 'all' | 'synced' | 'pending' | 'discarded';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getAvailableYears() {
  const currentYear = new Date().getFullYear();
  const years: { value: string; label: string }[] = [{ value: '', label: 'Todos los años' }];
  for (let y = currentYear; y >= 2023; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}

const YEARS = getAvailableYears();
const MONTHS = [
  { value: '', label: 'Todos los meses' },
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];
const PAGE_SIZE = 100;

export default function DianFacturasPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Recibido');
  const [documents, setDocuments] = useState<DianDocument[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [siigoStatus, setSiigoStatus] = useState<SiigoStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [prefixFilter, setPrefixFilter] = useState('');

  // Sync state
  const [syncYear, setSyncYear] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState('');

  // Backfill state
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ matched: number; checked: number } | null>(null);
  const [backfillError, setBackfillError] = useState('');

  // Discard state
  const [discardingIds, setDiscardingIds] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    setCurrentPage(1);
    try {
      const params = new URLSearchParams();
      params.set('group', activeTab);
      if (search) params.set('search', search);
      if (selectedYear && selectedMonth) {
        params.set('month', `${selectedYear}-${selectedMonth}`);
      } else if (selectedYear) {
        params.set('year', selectedYear);
      }
      if (siigoStatus !== 'all') params.set('siigoStatus', siigoStatus);
      const res = await fetch(`/api/dian?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error cargando documentos DIAN');
      setDocuments(data.documents);
      setSummary(data.summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, selectedYear, selectedMonth, siigoStatus]);

  useEffect(() => {
    const timer = setTimeout(fetchDocuments, 300);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setExpandedId(null);
    setSearch('');
    setSelectedYear('');
    setSelectedMonth('');
    setSiigoStatus('all');
    setPrefixFilter('');
    setSyncResult(null);
    setSyncError('');
    setBackfillResult(null);
    setBackfillError('');
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError('');
    try {
      const body: Record<string, string> = {};
      if (syncYear) body.year = syncYear;
      const res = await fetch('/api/siigo/purchases/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en sincronización');
      setSyncResult(data);
      if (data.created > 0) fetchDocuments();
    } catch (e: any) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    setBackfillError('');
    try {
      const res = await fetch('/api/siigo/purchases/backfill', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en identificación');
      setBackfillResult(data);
      if (data.matched > 0) fetchDocuments();
    } catch (e: any) {
      setBackfillError(e.message);
    } finally {
      setBackfilling(false);
    }
  };

  const handleDiscard = async (ids: string[]) => {
    setDiscardingIds(prev => new Set([...prev, ...ids]));
    try {
      const res = await fetch('/api/siigo/purchases/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Error al descartar');
      fetchDocuments();
    } catch (e: any) {
      console.error('Discard error:', e.message);
    } finally {
      setDiscardingIds(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    }
  };

  const handle409Discard = () => {
    if (!syncResult) return;
    const error409Folios = new Set(
      syncResult.errors.filter(e => e.error.includes('409')).map(e => e.folio)
    );
    const ids = documents
      .filter(d => {
        const folio = d.prefix ? `${d.prefix}-${d.number}` : d.number;
        return error409Folios.has(folio) && !d.siigo_purchase_id;
      })
      .map(d => d.id);
    if (ids.length > 0) handleDiscard(ids);
  };

  const hasFilters = search || selectedYear || selectedMonth || prefixFilter || siigoStatus !== 'all';
  const clearFilters = () => { setSearch(''); setSelectedYear(''); setSelectedMonth(''); setPrefixFilter(''); setSiigoStatus('all'); };

  const isCompras = activeTab === 'Recibido';

  const availablePrefixes = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) {
      if (doc.prefix) set.add(doc.prefix);
    }
    return Array.from(set).sort();
  }, [documents]);

  const filteredDocuments = prefixFilter ? documents.filter(d => d.prefix === prefixFilter) : documents;

  const displaySummary = prefixFilter
    ? {
        total: filteredDocuments.length,
        totalAmount: filteredDocuments.reduce((sum, d) => sum + (d.amount || 0), 0),
        totalIva: filteredDocuments.reduce((sum, d) => sum + (d.tax_amount || 0), 0),
      }
    : summary;

  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE);
  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const syncedCount = documents.filter(d => d.siigo_purchase_id && d.siigo_purchase_id !== 'DESCARTADO').length;
  const pendingCount = documents.filter(d => !d.siigo_purchase_id).length;
  const discardedCount = documents.filter(d => d.siigo_purchase_id === 'DESCARTADO').length;

  const errors409Count = syncResult?.errors.filter(e => e.error.includes('409')).length ?? 0;

  const STATUS_FILTERS: { value: SiigoStatus; label: string; count?: number }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'synced', label: 'En Siigo', count: syncedCount },
    { value: 'pending', label: 'Solo DIAN', count: pendingCount },
    { value: 'discarded', label: 'Descartadas', count: discardedCount },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-7 h-7 text-amber-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Facturas DIAN</h1>
              <p className="text-sm text-gray-500 mt-0.5">Documentos electrónicos importados del portal DIAN</p>
            </div>
          </div>
          {isCompras && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Backfill */}
              <button
                onClick={handleBackfill}
                disabled={backfilling}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {backfilling
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Identificando...</span></>
                  : <><GitMerge className="w-4 h-4" /><span>Identificar existentes</span></>}
              </button>
              {/* Sync with year filter */}
              <div className="flex items-center gap-1">
                <select
                  value={syncYear}
                  onChange={(e) => setSyncYear(e.target.value)}
                  className="text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                </select>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {syncing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Sincronizando...</span></>
                    : <><RefreshCw className="w-4 h-4" /><span>Sync Siigo{syncYear ? ` · ${syncYear}` : ' · todos'}</span></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex space-x-0">
          <button
            onClick={() => handleTabChange('Recibido')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'Recibido'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Compras (Recibidas)</span>
          </button>
          <button
            onClick={() => handleTabChange('Emitido')}
            className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'Emitido'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Ventas (Emitidas)</span>
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* Banners */}
        {syncError && (
          <div className="flex items-start space-x-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-4 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{syncError}</p>
            <button onClick={() => setSyncError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {backfillError && (
          <div className="flex items-start space-x-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-4 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{backfillError}</p>
            <button onClick={() => setBackfillError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {backfillResult && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-5 py-4 text-sm">
            <div className="flex items-center space-x-2">
              <GitMerge className="w-5 h-5" />
              <p>
                {backfillResult.matched > 0
                  ? <><strong>{backfillResult.matched}</strong> facturas identificadas en Siigo (de {backfillResult.checked} revisadas)</>
                  : <>Ninguna factura nueva identificada ({backfillResult.checked} revisadas)</>}
              </p>
            </div>
            <button onClick={() => setBackfillResult(null)} className="text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {syncResult && (
          <div className={`rounded-xl border px-5 py-4 text-sm space-y-2 ${
            syncResult.errors.length === 0
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5" />
                <p className="font-semibold">
                  {syncResult.message || `${syncResult.created} de ${syncResult.total} facturas creadas en Siigo`}
                </p>
              </div>
              <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            {syncResult.errors.length > 0 && (
              <>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                  {syncResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-yellow-700">
                      <span className="font-mono font-semibold">{e.folio}</span> ({e.issuer}) — {e.error}
                    </p>
                  ))}
                </div>
                {errors409Count > 0 && (
                  <button
                    onClick={handle409Discard}
                    className="flex items-center space-x-1 text-xs font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded-lg px-3 py-1.5 mt-2"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Descartar {errors409Count} con período bloqueado (409)</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Summary Cards */}
        {displaySummary && (
          <div className={`grid grid-cols-2 gap-4 ${isCompras ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{isCompras ? 'Facturas de compra' : 'Facturas de venta'}</p>
                  <p className="text-xl font-bold text-gray-900">{displaySummary.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{isCompras ? 'Total compras' : 'Total ventas'}</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(displaySummary.totalAmount)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{isCompras ? 'IVA descontable' : 'IVA generado'}</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(displaySummary.totalIva)}</p>
                </div>
              </div>
            </div>
            {isCompras && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">En Siigo</p>
                      <p className="text-xl font-bold text-green-700">
                        {syncedCount}
                        <span className="text-sm font-normal text-gray-400 ml-1">/ {documents.length}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pendientes</p>
                      <p className="text-xl font-bold text-orange-600">{pendingCount}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={isCompras ? 'Buscar por emisor o folio...' : 'Buscar por receptor o folio...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedMonth(''); }}
              className="text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={!selectedYear}
              className="text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 px-2 py-2">
                <X className="w-4 h-4" /><span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Status filter — solo en Compras */}
          {isCompras && (
            <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-400 font-medium">Estado:</span>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => { setSiigoStatus(f.value); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    siigoStatus === f.value
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'
                  }`}
                >
                  {f.label}{f.count !== undefined && siigoStatus === 'all' ? ` (${f.count})` : ''}
                </button>
              ))}
            </div>
          )}

          {availablePrefixes.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-400 font-medium">Tipo:</span>
              <button
                onClick={() => { setPrefixFilter(''); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  prefixFilter === '' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'
                }`}
              >Todos</button>
              {availablePrefixes.map(p => (
                <button
                  key={p}
                  onClick={() => { setPrefixFilter(p); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    prefixFilter === p ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'
                  }`}
                >{p}</button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="w-10 h-10 mb-2" />
              <p className="text-sm">No hay facturas {isCompras ? 'de compra' : 'de venta'} en esta vista</p>
              {siigoStatus === 'all' && <p className="text-xs mt-1">Ve a <strong>DIAN → Importar</strong> para subir el reporte</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Folio</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha emisión</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {isCompras ? 'Emisor (Proveedor)' : 'Receptor (Cliente)'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">NIT</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IVA</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    {isCompras
                      ? <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Siigo</th>
                      : <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    }
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedDocuments.map((doc) => {
                    const isSynced = isCompras && !!doc.siigo_purchase_id && doc.siigo_purchase_id !== 'DESCARTADO';
                    const isDiscarded = doc.siigo_purchase_id === 'DESCARTADO';
                    const isDiscarding = discardingIds.has(doc.id);
                    return (
                      <Fragment key={doc.id}>
                        <tr className={`hover:bg-gray-50 transition-colors ${isDiscarded ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs text-amber-700 font-medium">
                            {doc.prefix ? `${doc.prefix}-${doc.number}` : doc.number}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(doc.issue_date)}</td>
                          <td className="px-4 py-3 text-gray-900 max-w-[220px] truncate" title={isCompras ? doc.issuer_name : doc.receiver_name}>
                            {isCompras ? doc.issuer_name : doc.receiver_name}
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                            {isCompras ? doc.issuer_nit : doc.receiver_nit}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(doc.tax_amount)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(doc.amount)}</td>
                          {isCompras ? (
                            <td className="px-4 py-3 text-center">
                              {isDiscarded ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                  <Ban className="w-3 h-3" /><span>Descartada</span>
                                </span>
                              ) : isSynced ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  <CheckCircle2 className="w-3 h-3" /><span>Siigo</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                  <Clock className="w-3 h-3" /><span>Pendiente</span>
                                </span>
                              )}
                            </td>
                          ) : (
                            <td className="px-4 py-3">
                              {doc.status
                                ? <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{doc.status}</span>
                                : <span className="text-xs text-gray-400">—</span>}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-600"
                            >
                              {expandedId === doc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                        {expandedId === doc.id && (
                          <tr key={`${doc.id}-detail`} className="bg-amber-50">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <p className="text-gray-500 font-medium mb-1">CUFE</p>
                                  <p className="font-mono text-gray-700 break-all">{doc.cufe}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium mb-1">Fecha recepción</p>
                                  <p className="text-gray-700">{doc.reception_date ? doc.reception_date.replace('T', ' ') : '—'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium mb-1">{isCompras ? 'Receptor' : 'Emisor'}</p>
                                  <p className="text-gray-700">
                                    {isCompras ? `${doc.receiver_name} (${doc.receiver_nit})` : `${doc.issuer_name} (${doc.issuer_nit})`}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500 font-medium mb-1">Tipo documento</p>
                                  <p className="text-gray-700">{doc.document_type}</p>
                                </div>
                                {isCompras && isSynced && (
                                  <div>
                                    <p className="text-gray-500 font-medium mb-1">ID Siigo</p>
                                    <p className="font-mono text-green-700 text-xs">{doc.siigo_purchase_id}</p>
                                  </div>
                                )}
                                {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                                  <div className="col-span-2 md:col-span-4">
                                    <p className="text-gray-500 font-medium mb-1">Otros impuestos</p>
                                    <div className="flex flex-wrap gap-3">
                                      {Object.entries(doc.metadata).map(([k, v]) => (
                                        <span key={k} className="text-gray-700">
                                          {k.replace(/_/g, ' ').toUpperCase()}: {formatCurrency(v as number)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Discard action for pending compras */}
                                {isCompras && !isSynced && !isDiscarded && (
                                  <div className="col-span-2 md:col-span-4 pt-2 border-t border-amber-200">
                                    <button
                                      onClick={() => handleDiscard([doc.id])}
                                      disabled={isDiscarding}
                                      className="flex items-center space-x-1 text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
                                    >
                                      {isDiscarding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                                      <span>Descartar esta factura</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-xs text-gray-500 uppercase">
                      Total ({filteredDocuments.length} facturas)
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {formatCurrency(filteredDocuments.reduce((s, d) => s + (d.tax_amount || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(filteredDocuments.reduce((s, d) => s + (d.amount || 0), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {!loading && filteredDocuments.length > 0 && (
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs text-gray-400">
              Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredDocuments.length)} de {filteredDocuments.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
                <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Siguiente →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
