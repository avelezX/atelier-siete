'use client';

import { useState, useCallback, useRef } from 'react';
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

type UploadState = 'idle' | 'selected' | 'uploading' | 'success' | 'duplicate' | 'error';

interface UploadResult {
  success: boolean;
  period: string;
  totalParsed: number;
  totalInserted: number;
  duplicatesSkipped: number;
  skippedRows: number;
  warnings: string[];
  errors: string[];
}

interface DuplicateInfo {
  existingCount: number;
  newCount: number;
  period: string;
  message: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function DianUploadDropzone() {
  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [groupOverride, setGroupOverride] = useState<'Recibido' | 'Emitido' | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMsg('Solo se aceptan archivos .xlsx');
      setState('error');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setErrorMsg('El archivo es muy grande (max 20MB)');
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
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const uploadFile = useCallback(async (force = false, confirm = false) => {
    if (!file) return;
    setState('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (groupOverride) formData.append('group_override', groupOverride);
      const url = `/api/upload/dian${force ? '?force=true' : confirm ? '?confirm=true' : ''}`;
      const response = await fetch(url, { method: 'POST', body: formData });
      const data = await response.json();

      if (response.status === 409 && data.error === 'duplicate') {
        setDuplicateInfo({
          existingCount: data.existingCount,
          newCount: data.newCount,
          period: data.period,
          message: data.message,
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
    } catch (e: any) {
      setErrorMsg(e.message || 'Error de conexión');
      setState('error');
    }
  }, [file, groupOverride]);

  const reset = useCallback(() => {
    setState('idle');
    setFile(null);
    setResult(null);
    setDuplicateInfo(null);
    setErrorMsg('');
    setGroupOverride('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  if (state === 'idle') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <p className="text-sm text-amber-800">
            Descarga el reporte de documentos desde el portal DIAN y súbelo aquí.
            Solo se importan <strong>Facturas electrónicas</strong> — los Application response se omiten automáticamente.
          </p>
        </div>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-1">Arrastra el reporte DIAN aquí</p>
          <p className="text-sm text-gray-500">o haz click para seleccionar un archivo .xlsx</p>
        </div>
      </div>
    );
  }

  if (state === 'selected' && file) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
        <div className="flex items-center space-x-4">
          <FileSpreadsheet className="w-10 h-10 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500">{formatBytes(file.size)}</p>
          </div>
          <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">Cambiar</button>
        </div>

        {/* Tipo de facturas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Qué tipo de facturas contiene este archivo?
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setGroupOverride('Recibido')}
              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                groupOverride === 'Recibido'
                  ? 'border-amber-600 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}
            >
              Compras (recibidas)
            </button>
            <button
              onClick={() => setGroupOverride('Emitido')}
              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                groupOverride === 'Emitido'
                  ? 'border-amber-600 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}
            >
              Ventas (emitidas)
            </button>
            <button
              onClick={() => setGroupOverride('')}
              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                groupOverride === ''
                  ? 'border-amber-600 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}
            >
              Del archivo
            </button>
          </div>
          {groupOverride === '' && (
            <p className="text-xs text-gray-400 mt-1.5">Se usará el campo del Excel. Selecciona Compras o Ventas si el archivo no lo incluye.</p>
          )}
        </div>

        <button
          onClick={() => uploadFile(false)}
          className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors"
        >
          Importar Facturas DIAN
        </button>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 text-center">
        <Loader2 className="w-10 h-10 text-amber-600 mx-auto mb-4 animate-spin" />
        <p className="text-lg font-medium text-gray-700">Procesando archivo DIAN...</p>
        <p className="text-sm text-gray-500 mt-1">Parseando facturas e insertando en base de datos</p>
      </div>
    );
  }

  if (state === 'duplicate' && duplicateInfo) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-orange-200 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">Documentos existentes</h3>
            <p className="text-sm text-gray-600 mt-1">{duplicateInfo.message}</p>
          </div>
        </div>
        {duplicateInfo.newCount > 0 ? (
          <div className="flex space-x-3">
            <button
              onClick={() => uploadFile(false, true)}
              className="flex-1 bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              Importar solo los {duplicateInfo.newCount} nuevos
            </button>
            <button onClick={reset} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={reset} className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">
            Volver
          </button>
        )}
      </div>
    );
  }

  if (state === 'success' && result) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-green-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <h3 className="font-semibold text-gray-900">Importación exitosa</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{result.totalInserted}</p>
            <p className="text-xs text-gray-500">Importadas</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{result.totalParsed}</p>
            <p className="text-xs text-gray-500">Encontradas</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{result.duplicatesSkipped}</p>
            <p className="text-xs text-gray-500">Duplicadas</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-400">{result.skippedRows}</p>
            <p className="text-xs text-gray-500">App. Response</p>
          </div>
        </div>
        {result.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-yellow-800 mb-1">{result.warnings.length} advertencia(s)</p>
            {result.warnings.slice(0, 5).map((w, i) => (
              <p key={i} className="text-xs text-yellow-700">{w}</p>
            ))}
          </div>
        )}
        {result.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-red-800 mb-1">{result.errors.length} error(es)</p>
            {result.errors.map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
          </div>
        )}
        <button onClick={reset} className="w-full bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors">
          Importar otro archivo
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="bg-white rounded-xl shadow-md border border-red-200 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">Error</h3>
            <p className="text-sm text-gray-600 mt-1">{errorMsg}</p>
          </div>
        </div>
        <button onClick={reset} className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">
          Intentar de nuevo
        </button>
      </div>
    );
  }

  return null;
}
