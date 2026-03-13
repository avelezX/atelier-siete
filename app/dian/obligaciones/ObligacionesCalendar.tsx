'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck, ExternalLink, CheckCircle2, Clock, AlertTriangle,
  XCircle, ChevronDown, ChevronRight, FileText, Info,
  Paperclip, Download, Trash2, Upload,
  Calendar, List, X,
} from 'lucide-react';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type ObligacionStatus = 'pendiente' | 'cumplida' | 'na' | 'verificar';
export type ObligacionPriority = 'critica' | 'alta' | 'media' | 'baja' | 'verificar';

export interface Obligacion {
  id: string;
  year: number;
  month: string;
  due_date: string;
  obligation: string;
  formulario: string;
  period: string | null;
  priority: ObligacionPriority;
  muisca_section: string | null;
  instructions: string | null;
  status: ObligacionStatus;
  completed_at: string | null;
  completion_notes: string | null;
  radicado: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachments: Array<{ name: string; path: string }> | null;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T12:00:00');
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// -----------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------

const PRIORITY_CONFIG: Record<ObligacionPriority, { label: string; color: string; bg: string }> = {
  critica:   { label: 'Crítica',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  alta:      { label: 'Alta',      color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  media:     { label: 'Media',     color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  baja:      { label: 'Baja',      color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
  verificar: { label: 'Verificar', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
};

const STATUS_CONFIG: Record<ObligacionStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pendiente: { label: 'Pendiente', icon: <Clock className="w-4 h-4" />,         color: 'text-gray-500' },
  cumplida:  { label: 'Cumplida',  icon: <CheckCircle2 className="w-4 h-4" />,  color: 'text-green-600' },
  na:        { label: 'N/A',       icon: <XCircle className="w-4 h-4" />,       color: 'text-gray-400' },
  verificar: { label: 'Verificar', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-500' },
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

// -----------------------------------------------------------------------
// Chip color
// -----------------------------------------------------------------------

function getChipStyle(ob: Obligacion): string {
  if (ob.status === 'cumplida')  return 'bg-green-100 text-green-700 border-green-300';
  if (ob.status === 'na')        return 'bg-gray-100 text-gray-400 border-gray-200';
  if (ob.status === 'verificar') return 'bg-amber-100 text-amber-700 border-amber-300';
  const days = daysUntil(ob.due_date);
  if (days < 0)  return 'bg-red-100 text-red-700 border-red-300';
  if (days <= 7) return 'bg-orange-100 text-orange-700 border-orange-300';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

// -----------------------------------------------------------------------
// DaysBadge
// -----------------------------------------------------------------------

function DaysBadge({ days, status }: { days: number; status: ObligacionStatus }) {
  if (status === 'cumplida')  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Cumplida</span>;
  if (status === 'na')        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">N/A</span>;
  if (status === 'verificar') return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Verificar</span>;
  if (days < 0)  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Vencida ({Math.abs(days)}d)</span>;
  if (days === 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium animate-pulse">¡Hoy!</span>;
  if (days <= 7)  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">{days}d</span>;
  if (days <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">{days}d</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{days}d</span>;
}

// -----------------------------------------------------------------------
// ObligacionChip — tiny chip rendered on a calendar day cell
// -----------------------------------------------------------------------

function ObligacionChip({ ob, onClick }: { ob: Obligacion; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${ob.obligation}${ob.period ? ' · ' + ob.period : ''}`}
      className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded border font-semibold truncate transition-opacity hover:opacity-75 ${getChipStyle(ob)}`}
    >
      {ob.formulario}
      {(ob.attachments?.length ?? 0) > 0 && <span className="ml-0.5 opacity-50">📎</span>}
    </button>
  );
}

// -----------------------------------------------------------------------
// MonthCalendar — single month mini-grid
// -----------------------------------------------------------------------

function MonthCalendar({ year, monthIndex, obligations, onChipClick }: {
  year: number;
  monthIndex: number;
  obligations: Obligacion[];
  onChipClick: (ob: Obligacion) => void;
}) {
  const startDow    = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === d;

  const obsByDay = new Map<number, Obligacion[]>();
  for (const ob of obligations) {
    const d = new Date(ob.due_date + 'T12:00:00');
    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      const day = d.getDate();
      if (!obsByDay.has(day)) obsByDay.set(day, []);
      obsByDay.get(day)!.push(ob);
    }
  }

  const hasObs = obsByDay.size > 0;

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${hasObs ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className={`px-3 py-2 border-b ${hasObs ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${hasObs ? 'text-amber-800' : 'text-gray-400'}`}>
          {MONTH_NAMES[monthIndex]}
        </h3>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[9px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const dayObs  = day ? (obsByDay.get(day) || []) : [];
          const lastCol = idx % 7 === 6;

          return (
            <div
              key={idx}
              className={`min-h-[46px] p-0.5 border-b border-gray-50 ${!lastCol ? 'border-r border-gray-50' : ''} ${!day ? 'bg-gray-50/40' : ''}`}
            >
              {day && (
                <>
                  <div className={`text-[10px] font-medium leading-none mb-0.5 flex items-center justify-center h-4 w-4 mx-auto rounded-full ${
                    isToday(day) ? 'bg-amber-600 text-white' : dayObs.length > 0 ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayObs.slice(0, 3).map(ob => (
                      <ObligacionChip key={ob.id} ob={ob} onClick={() => onChipClick(ob)} />
                    ))}
                    {dayObs.length > 3 && (
                      <button
                        onClick={() => onChipClick(dayObs[3])}
                        className="text-[9px] text-gray-400 hover:text-gray-600 w-full text-center"
                      >
                        +{dayObs.length - 3}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// YearCalendarGrid — 4 months per row
// -----------------------------------------------------------------------

function YearCalendarGrid({ year, obligations, onChipClick }: {
  year: number;
  obligations: Obligacion[];
  onChipClick: (ob: Obligacion) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, i) => (
        <MonthCalendar
          key={i}
          year={year}
          monthIndex={i}
          obligations={obligations}
          onChipClick={onChipClick}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// AttachmentsSection
// -----------------------------------------------------------------------

function AttachmentsSection({
  obId,
  attachments,
  onAttachmentsChange,
}: {
  obId: string;
  attachments: Array<{ name: string; path: string }>;
  onAttachmentsChange: (attachments: Array<{ name: string; path: string }>) => void;
}) {
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res  = await fetch(`/api/dian/obligaciones/${obId}/attachment`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) setUploadError(data.error || 'Error al subir');
      else onAttachmentsChange(data.attachments || []);
    } catch { setUploadError('Error de conexión'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDownload = async (name: string) => {
    const res  = await fetch(`/api/dian/obligaciones/${obId}/attachment?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`¿Eliminar el adjunto "${name}"?`)) return;
    const res  = await fetch(`/api/dian/obligaciones/${obId}/attachment?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) onAttachmentsChange(data.attachments || []);
  };

  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-gray-50">
      <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" /> Comprobantes / Soportes
      </p>

      {attachments.length > 0 && (
        <div className="space-y-1 mb-2">
          {attachments.map((att) => (
            <div key={att.name} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate">{att.name}</span>
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <button onClick={() => handleDownload(att.name)} title="Descargar"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(att.name)} title="Eliminar"
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className={`flex items-center justify-center gap-2 py-2 border border-dashed rounded-lg cursor-pointer transition-colors ${
        uploading ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50'
      }`}>
        {uploading
          ? <><div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /><span className="text-xs text-amber-600">Subiendo...</span></>
          : <><Upload className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500">Agregar comprobante</span><span className="text-xs text-gray-400">máx. 20 MB</span></>
        }
        <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
      </label>

      {uploadError && <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------
// ObligacionDetailPanel — right-side drawer
// -----------------------------------------------------------------------

function ObligacionDetailPanel({ ob, onClose, onStatusChange, onAttachmentChange }: {
  ob: Obligacion;
  onClose: () => void;
  onStatusChange: (id: string, status: ObligacionStatus, notes?: string, radicado?: string) => Promise<void>;
  onAttachmentChange: (id: string, attachments: Array<{ name: string; path: string }>) => void;
}) {
  const [saving, setSaving]     = useState(false);
  const [notes, setNotes]       = useState(ob.completion_notes || '');
  const [radicado, setRadicado] = useState(ob.radicado || '');

  useEffect(() => {
    setNotes(ob.completion_notes || '');
    setRadicado(ob.radicado || '');
  }, [ob.id]);

  const days     = daysUntil(ob.due_date);
  const priority = PRIORITY_CONFIG[ob.priority];

  const handleStatusToggle = async () => {
    const next: ObligacionStatus = ob.status === 'cumplida' ? 'pendiente' : 'cumplida';
    setSaving(true);
    await onStatusChange(ob.id, next, notes, radicado);
    setSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await onStatusChange(ob.id, ob.status, notes, radicado);
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">

        <div className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${priority.bg}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-700">
                {ob.formulario}
              </span>
              <DaysBadge days={days} status={ob.status} />
            </div>
            <h2 className="text-sm font-semibold text-gray-900 leading-snug">{ob.obligation}</h2>
            {ob.period && <p className="text-xs text-gray-500 mt-0.5">{ob.period}</p>}
            <p className="text-xs text-gray-500 mt-1">Vence: {formatDate(ob.due_date)}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <span className={STATUS_CONFIG[ob.status].color}>{STATUS_CONFIG[ob.status].icon}</span>
              <span className="text-sm font-medium text-gray-700">{STATUS_CONFIG[ob.status].label}</span>
            </div>
            <button
              onClick={handleStatusToggle}
              disabled={saving}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                ob.status === 'cumplida'
                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {saving ? '...' : ob.status === 'cumplida' ? 'Marcar pendiente' : 'Marcar cumplida'}
            </button>
          </div>

          {ob.muisca_section && (
            <div className="flex gap-2 text-xs text-gray-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
              <span><strong>En MUISCA:</strong> {ob.muisca_section}</span>
            </div>
          )}

          {ob.instructions && (
            <div className="flex gap-2 text-xs text-gray-600">
              <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
              <span className="whitespace-pre-line">{ob.instructions}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">N° Radicado / Formulario presentado</label>
              <input type="text" value={radicado} onChange={e => setRadicado(e.target.value)}
                placeholder="Ej: 9002563..."
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones..." rows={2}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-transparent resize-none" />
            </div>
          </div>

          <AttachmentsSection
            obId={ob.id}
            attachments={ob.attachments || []}
            onAttachmentsChange={(atts) => onAttachmentChange(ob.id, atts)}
          />

          {ob.status === 'cumplida' && ob.completed_at && (
            <p className="text-xs text-green-600">
              Marcada cumplida el {new Date(ob.completed_at).toLocaleDateString('es-CO', { dateStyle: 'long' })}
            </p>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between bg-gray-50">
          <a href="https://muisca.dian.gov.co" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800">
            <ExternalLink className="w-3.5 h-3.5" /> Ir a MUISCA
          </a>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">Cerrar</button>
            <button onClick={handleSave} disabled={saving}
              className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// -----------------------------------------------------------------------
// SummaryCards
// -----------------------------------------------------------------------

function SummaryCards({ obligations }: { obligations: Obligacion[] }) {
  const total     = obligations.length;
  const cumplidas = obligations.filter(o => o.status === 'cumplida').length;
  const vencidas  = obligations.filter(o => o.status === 'pendiente' && daysUntil(o.due_date) < 0).length;
  const proximas  = obligations.filter(o => o.status === 'pendiente' && daysUntil(o.due_date) >= 0 && daysUntil(o.due_date) <= 30).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs text-gray-500">Total</p>
        <p className="text-2xl font-bold text-gray-900">{total}</p>
        <p className="text-xs text-gray-400">obligaciones</p>
      </div>
      <div className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
        <p className="text-xs text-green-600">Cumplidas</p>
        <p className="text-2xl font-bold text-green-700">{cumplidas}</p>
        <p className="text-xs text-gray-400">{total > 0 ? Math.round(cumplidas / total * 100) : 0}% completado</p>
      </div>
      <div className={`rounded-xl border shadow-sm p-4 ${vencidas > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
        <p className={`text-xs ${vencidas > 0 ? 'text-red-600' : 'text-gray-500'}`}>Vencidas</p>
        <p className={`text-2xl font-bold ${vencidas > 0 ? 'text-red-700' : 'text-gray-900'}`}>{vencidas}</p>
        <p className="text-xs text-gray-400">sin cumplir</p>
      </div>
      <div className={`rounded-xl border shadow-sm p-4 ${proximas > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
        <p className={`text-xs ${proximas > 0 ? 'text-orange-600' : 'text-gray-500'}`}>Próximas 30d</p>
        <p className={`text-2xl font-bold ${proximas > 0 ? 'text-orange-700' : 'text-gray-900'}`}>{proximas}</p>
        <p className="text-xs text-gray-400">por vencer</p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// ObligacionRow — list view item (expandable)
// -----------------------------------------------------------------------

function ObligacionRow({ ob, onStatusChange, onAttachmentChange }: {
  ob: Obligacion;
  onStatusChange: (id: string, status: ObligacionStatus, notes?: string, radicado?: string) => Promise<void>;
  onAttachmentChange: (id: string, attachments: Array<{ name: string; path: string }>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [notes, setNotes]       = useState(ob.completion_notes || '');
  const [radicado, setRadicado] = useState(ob.radicado || '');

  const days     = daysUntil(ob.due_date);
  const priority = PRIORITY_CONFIG[ob.priority];

  const handleStatusToggle = async () => {
    const next: ObligacionStatus = ob.status === 'cumplida' ? 'pendiente' : 'cumplida';
    setSaving(true);
    await onStatusChange(ob.id, next, notes, radicado);
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    await onStatusChange(ob.id, ob.status, notes, radicado);
    setSaving(false);
    setExpanded(false);
  };

  return (
    <div className={`border rounded-lg mb-2 ${ob.status === 'cumplida' ? 'opacity-60' : ''} ${priority.bg} border`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={handleStatusToggle}
          disabled={saving}
          title={ob.status === 'cumplida' ? 'Marcar como pendiente' : 'Marcar como cumplida'}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            ob.status === 'cumplida' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-400 hover:border-green-500'
          } ${saving ? 'opacity-50' : ''}`}
        >
          {ob.status === 'cumplida' && (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
              <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="flex-shrink-0 w-24 text-xs text-gray-500 font-mono">{formatDate(ob.due_date)}</div>

        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${ob.status === 'cumplida' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {ob.obligation}
          </span>
          {ob.period && <span className="text-xs text-gray-400 ml-2">· {ob.period}</span>}
        </div>

        {(ob.attachments?.length ?? 0) > 0 && (
          <Paperclip className="flex-shrink-0 w-3.5 h-3.5 text-green-600" title={(ob.attachments?.length ?? 0) + ' adjunto(s)'} />
        )}

        <span className="flex-shrink-0 text-xs font-mono bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">
          {ob.formulario}
        </span>

        <div className="flex-shrink-0"><DaysBadge days={days} status={ob.status} /></div>

        <span className={`flex-shrink-0 text-xs font-medium ${priority.color} hidden sm:block`}>{priority.label}</span>

        <a href="https://muisca.dian.gov.co" target="_blank" rel="noopener noreferrer"
          title="Ir a MUISCA" className="flex-shrink-0 text-amber-500 hover:text-amber-700"
          onClick={e => e.stopPropagation()}>
          <ExternalLink className="w-4 h-4" />
        </a>

        <button onClick={() => setExpanded(p => !p)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 rounded-b-lg space-y-3">
          {ob.muisca_section && (
            <div className="flex gap-2 text-xs text-gray-600">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
              <span><strong>En MUISCA:</strong> {ob.muisca_section}</span>
            </div>
          )}
          {ob.instructions && (
            <div className="flex gap-2 text-xs text-gray-600">
              <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
              <span className="whitespace-pre-line">{ob.instructions}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">N° Radicado / Formulario</label>
              <input type="text" value={radicado} onChange={e => setRadicado(e.target.value)}
                placeholder="Ej: 9002563..."
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Notas</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones..."
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-transparent" />
            </div>
          </div>

          <AttachmentsSection
            obId={ob.id}
            attachments={ob.attachments || []}
            onAttachmentsChange={(atts) => onAttachmentChange(ob.id, atts)}
          />

          {ob.status === 'cumplida' && ob.completed_at && (
            <p className="text-xs text-green-600">
              Marcada cumplida el {new Date(ob.completed_at).toLocaleDateString('es-CO', { dateStyle: 'long' })}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setExpanded(false)} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700">Cancelar</button>
            <button onClick={handleSaveNotes} disabled={saving}
              className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------

export default function ObligacionesCalendar() {
  const [obligations, setObligations]   = useState<Obligacion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [year, setYear]                 = useState<number | 'all'>(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState<'todas' | ObligacionStatus>('todas');
  const [viewMode, setViewMode]         = useState<'calendar' | 'list'>('calendar');
  const [selectedObId, setSelectedObId] = useState<string | null>(null);

  const fetchObligations = useCallback(async () => {
    setLoading(true);
    try {
      const url  = year === 'all' ? '/api/dian/obligaciones' : `/api/dian/obligaciones?year=${year}`;
      const res  = await fetch(url);
      const data = await res.json();
      setObligations(data.obligations || []);
    } catch {
      setObligations([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchObligations(); }, [fetchObligations]);

  const handleAttachmentChange = (id: string, attachments: Array<{ name: string; path: string }>) => {
    setObligations(prev => prev.map(o => o.id === id ? { ...o, attachments } : o));
  };

  const handleStatusChange = async (id: string, status: ObligacionStatus, notes?: string, radicado?: string) => {
    await fetch(`/api/dian/obligaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, completion_notes: notes, radicado }),
    });
    setObligations(prev =>
      prev.map(o =>
        o.id === id
          ? { ...o, status, completion_notes: notes ?? o.completion_notes, radicado: radicado ?? o.radicado, completed_at: status === 'cumplida' ? new Date().toISOString() : null }
          : o
      )
    );
  };

  const filtered = obligations.filter(o => filterStatus === 'todas' || o.status === filterStatus);

  const selectedOb = selectedObId ? (obligations.find(o => o.id === selectedObId) ?? null) : null;

  const byMonth = filtered.reduce<Record<string, Obligacion[]>>((acc, o) => {
    const key = o.month || o.due_date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarCheck className="w-6 h-6 text-amber-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Obligaciones DIAN</h1>
              <p className="text-xs text-gray-500">Atelier Siete · NIT 901.764.924-4 · Régimen Común</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'calendar' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Calendario
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Lista
              </button>
            </div>

            <select
              value={year}
              onChange={e => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Todos los años</option>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500">
              <option value="todas">Todas</option>
              <option value="pendiente">Pendientes</option>
              <option value="cumplida">Cumplidas</option>
              <option value="verificar">Verificar</option>
              <option value="na">N/A</option>
            </select>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20 text-gray-400">Cargando obligaciones...</div>
        ) : obligations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-600 mb-1">
              Sin obligaciones{year === 'all' ? '' : ` para ${year}`}
            </h3>
            <p className="text-sm text-gray-400">Las obligaciones tributarias se agregarán próximamente.</p>
          </div>
        ) : (
          <>
            <SummaryCards obligations={obligations} />

            {/* MUISCA banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Portal MUISCA – DIAN</p>
                  <p className="text-xs text-amber-600">Gestiona tus declaraciones y pagos directamente en el portal oficial</p>
                </div>
              </div>
              <a href="https://muisca.dian.gov.co" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg transition-colors">
                Ir a MUISCA <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Calendar view */}
            {viewMode === 'calendar' && (() => {
              const calYears = year === 'all'
                ? Array.from(new Set(
                    filtered.map(o => new Date(o.due_date + 'T12:00:00').getFullYear())
                  )).sort()
                : [year as number];
              return (
                <div className="space-y-10">
                  {calYears.map(y => (
                    <div key={y}>
                      {year === 'all' && (
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-base font-bold text-gray-700">{y}</span>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                      )}
                      <YearCalendarGrid
                        year={y}
                        obligations={filtered}
                        onChipClick={ob => setSelectedObId(ob.id)}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* List view */}
            {viewMode === 'list' && Object.entries(byMonth).map(([monthKey, obs]) => (
              <div key={monthKey} className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                  {obs[0].month || monthKey}
                </h2>
                {obs.map(ob => (
                  <ObligacionRow
                    key={ob.id}
                    ob={ob}
                    onStatusChange={handleStatusChange}
                    onAttachmentChange={handleAttachmentChange}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Detail panel (calendar view) */}
      {selectedOb && (
        <ObligacionDetailPanel
          ob={selectedOb}
          onClose={() => setSelectedObId(null)}
          onStatusChange={handleStatusChange}
          onAttachmentChange={handleAttachmentChange}
        />
      )}
    </div>
  );
}
