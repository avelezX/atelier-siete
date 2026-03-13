'use client';

import { useState, useCallback, useRef } from 'react';
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

type UploadState = 'idle' | 'selected' | 'uploading' | 'success' | 'duplicate' | 'error';

interface UploadResult {
  success: boolean;
  period: string;
  totalParsed: number;
  totalInserted: number;
  storagePath: string | null;
  storageError: string | null;
  categorySummary: Record<string, number>;
  warnings: string[];
  errors: string[];
  metadata: {
    clientName: string;
    accountNumber: string;
    balanceAnterior: number;
    totalAbonos: number;
    totalCargos: number;
    balanceActual: number;
  };
}

interface DuplicateInfo {
  existingCount: number;
  newCount: number;
  period: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const MONTH_MAP: Record<string, string> = {
  'ENE': 'Enero', 'FEB': 'Febrero', 'MAR': 'Marzo', 'ABR': 'Abril',
  'MAY': 'Mayo', 'JUN': 'Junio', 'JUL': 'Julio', 'AGO': 'Agosto',
  'SEP': 'Septiembre', 'OCT': 'Octubre', 'NOV': 'Noviembre', 'DIC': 'Diciembre',
};

function detectPeriodFromFilename(filename: string): string | null {
  const upper = filename.toUpperCase();
  let monthName: string | null = null;
  for (const [abbr, name] of Object.entries(MONTH_MAP)) {
    if (upper.includes(abbr)) { monthName = name; break; }
  }
  const yearMatch = upper.match(/20\d{2}/);
  const year = yearMatch ? yearMatch[0] : null;
  if (monthName && year) return `${monthName} ${year}`;
  if (monthName) return monthName;
  if (year) return year;
  return null;
}

export default function UploadDropzone({ onSuccess }: { onSuccess?: () => void }) {
  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMsg('Solo se aceptan archivos .xlsx de Excel');
      setState('error');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg('El archivo es muy grande (max 10MB)');
      setState('error');
      return;
    }
    setFile(f);
    setState('selected');
    setErrorMsg('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const uploadFile = useCallback(async (force = false) => {
    if (!file) return;
    setState('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const url = `/api/upload/bancolombia${force ? '?force=true' : ''}`;
      const response = await fetch(url, { method: 'POST', body: formData });
      const data = await response.json();

      if (response.status === 409 && data.error === 'duplicate') {
        setDuplicateInfo({
          existingCount: data.existingCount,
          newCount: data.newCount,
          period: data.period,
        });
        setState('duplicate');
        return;
      }

      if (!response.ok) {
        setErrorMsg(data.error || 'Error al procesar el archivo');
        setState('error');
        return;
      }

      setResult(data);
      setState('success');
      onSuccess?.();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error de conexion');
      setState('error');
    }
  }, [file, onSuccess]);

  const reset = useCallback(() => {
    setState('idle');
    setFile(null);
    setResult(null);
    setDuplicateInfo(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  if (state === 'idle') {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-amber-500 bg-amber-50'
            : 'border-gray-300 bg-white hover:border-amber-400 hover:bg-amber-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-1">
          Arrastra un archivo Excel aqui
        </p>
        <p className="text-sm text-gray-500">
          o haz click para seleccionar un archivo .xlsx de Bancolombia
        </p>
      </div>
    );
  }

  if (state === 'selected' && file) {
    const detectedPeriod = detectPeriodFromFilename(file.name);
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center space-x-4 mb-4">
          <FileSpreadsheet className="w-10 h-10 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cambiar
          </button>
        </div>
        {detectedPeriod ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <span className="text-sm text-amber-800">
              Periodo detectado: <strong>{detectedPeriod}</strong>
            </span>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4">
            <span className="text-sm text-yellow-800">
              No se pudo detectar el periodo del nombre del archivo. Se determinara al parsear el contenido.
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => uploadFile(false)}
          className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors"
        >
          Importar Transacciones
        </button>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Loader2 className="w-10 h-10 text-amber-600 mx-auto mb-4 animate-spin" />
        <p className="text-lg font-medium text-gray-700">Procesando archivo...</p>
        <p className="text-sm text-gray-500 mt-1">Parseando, categorizando e insertando transacciones</p>
      </div>
    );
  }

  if (state === 'duplicate' && duplicateInfo) {
    return (
      <div className="bg-white rounded-xl border border-orange-200 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">Transacciones existentes</h3>
            <p className="text-sm text-gray-600 mt-1">
              Ya existen <strong>{duplicateInfo.existingCount}</strong> transacciones para el periodo{' '}
              <strong>{duplicateInfo.period}</strong>. El archivo contiene{' '}
              <strong>{duplicateInfo.newCount}</strong> transacciones.
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => uploadFile(true)}
            className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            Reemplazar Transacciones
          </button>
          <button
            onClick={reset}
            className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (state === 'success' && result) {
    const sortedCategories = Object.entries(result.categorySummary).sort((a, b) => b[1] - a[1]);

    return (
      <div className="bg-white rounded-xl border border-green-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <h3 className="font-semibold text-gray-900">Importacion exitosa</h3>
        </div>

        {!result.storagePath && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 mb-4">
            <p className="text-xs text-orange-700">
              Las transacciones se importaron pero el archivo no se guardó en Storage.
              {result.storageError && ` Error: ${result.storageError}`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{result.totalInserted}</p>
            <p className="text-xs text-gray-500">Transacciones</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{result.period}</p>
            <p className="text-xs text-gray-500">Periodo</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {result.totalInserted - (result.categorySummary['Sin categoria'] || 0)}
            </p>
            <p className="text-xs text-gray-500">Categorizadas</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">
              {result.categorySummary['Sin categoria'] || 0}
            </p>
            <p className="text-xs text-gray-500">Sin categoria</p>
          </div>
        </div>

        {sortedCategories.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Desglose por categoria</h4>
            <div className="space-y-1">
              {sortedCategories.map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{cat}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-yellow-800 mb-1">
              {result.warnings.length} advertencia(s)
            </p>
            {result.warnings.slice(0, 5).map((w, i) => (
              <p key={i} className="text-xs text-yellow-700">{w}</p>
            ))}
          </div>
        )}

        {result.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-red-800 mb-1">
              {result.errors.length} error(es)
            </p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-700">{e}</p>
            ))}
          </div>
        )}

        <button
          onClick={reset}
          className="w-full bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors"
        >
          Importar otro archivo
        </button>
      </div>
    );
  }

  // ERROR state
  return (
    <div className="bg-white rounded-xl border border-red-200 p-6">
      <div className="flex items-start space-x-3 mb-4">
        <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-gray-900">Error</h3>
          <p className="text-sm text-gray-600 mt-1">{errorMsg}</p>
        </div>
      </div>
      <button
        onClick={reset}
        className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
