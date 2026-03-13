import { FileText } from 'lucide-react';
import CreateInvoiceForm from './CreateInvoiceForm';

export const metadata = { title: 'Crear Factura — Atelier Siete' };

export default function CrearFacturaPage() {
  return (
    <div className="p-8">
      <div className="flex items-center space-x-3 mb-8">
        <FileText className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crear Factura</h1>
          <p className="text-gray-500">Nueva factura electrónica en Siigo</p>
        </div>
      </div>
      <CreateInvoiceForm />
    </div>
  );
}
