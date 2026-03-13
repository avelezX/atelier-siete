import { Upload } from 'lucide-react';
import DianUploadDropzone from '@/components/DianUploadDropzone';

export default function DianImportarPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center space-x-3 mb-8">
        <Upload className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar DIAN</h1>
          <p className="text-gray-500">Sube el reporte de facturas electrónicas del portal DIAN</p>
        </div>
      </div>
      <DianUploadDropzone />
    </div>
  );
}
