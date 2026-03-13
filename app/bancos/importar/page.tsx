'use client';

import { useState } from 'react';
import UploadDropzone from './UploadDropzone';
import UploadHistory from './UploadHistory';

export default function ImportarPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar Extracto</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Sube extractos de Bancolombia en formato Excel (.xlsx)
        </p>
      </div>
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">
        <UploadDropzone onSuccess={() => setRefreshKey(k => k + 1)} />
        <UploadHistory refreshKey={refreshKey} />
      </div>
    </div>
  );
}
