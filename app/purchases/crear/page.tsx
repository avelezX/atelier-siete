import { ShoppingCart } from 'lucide-react';
import CreatePurchaseForm from './CreatePurchaseForm';

export const metadata = { title: 'Crear Factura Compra — Atelier Siete' };

export default function CrearCompraPage() {
  return (
    <div className="p-8">
      <div className="flex items-center space-x-3 mb-8">
        <ShoppingCart className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crear Factura Compra</h1>
          <p className="text-gray-500">Nueva factura de compra en Siigo (gastos del local)</p>
        </div>
      </div>
      <CreatePurchaseForm />
    </div>
  );
}
