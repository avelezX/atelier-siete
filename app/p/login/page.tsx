import { redirect } from 'next/navigation';

// El login de proveedores ahora es el mismo login unificado
export default function ProveedorLoginRedirect() {
  redirect('/login');
}
