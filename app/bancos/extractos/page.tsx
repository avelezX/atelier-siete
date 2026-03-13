import { atelierTableAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, Wallet, Landmark } from 'lucide-react';
import ExtractosMonthSelector from './ExtractosMonthSelector';
import CategorySelector from '@/components/CategorySelector';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAvailableMonths(): Promise<string[]> {
  const allMonths = new Set<string>();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await atelierTableAdmin('transactions')
      .select('date')
      .order('date', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;
    data.forEach((t: { date: string }) => allMonths.add(t.date.substring(0, 7)));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return Array.from(allMonths).sort().reverse();
}

async function getMonthTransactions(month: string) {
  const startDate = `${month}-01`;
  const [yearStr, monthStr] = month.split('-');
  const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 0).toISOString().split('T')[0];

  const allTransactions: any[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await atelierTableAdmin('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;
    allTransactions.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allTransactions;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function formatMonthTitle(month: string): string {
  const d = new Date(month + '-15');
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' });
}

export default async function ExtractosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const availableMonths = await getAvailableMonths();

  if (availableMonths.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay transacciones importadas</p>
          <p className="text-gray-400 text-sm mt-1">Ve a <strong>Bancos → Importar</strong> para subir un extracto</p>
        </div>
      </div>
    );
  }

  const selectedMonth = params.month || availableMonths[0];
  const transactions = await getMonthTransactions(selectedMonth);

  let openingBalance = 0;
  let closingBalance = 0;
  let totalCredits = 0;
  let totalDebits = 0;

  if (transactions.length > 0) {
    const first = transactions[0];
    const firstAmount = Number(first.amount);
    const firstBalance = Number(first.balance);
    openingBalance = first.type === 'credit'
      ? firstBalance - firstAmount
      : firstBalance + firstAmount;

    closingBalance = Number(transactions[transactions.length - 1].balance);

    transactions.forEach((t: any) => {
      const amount = Number(t.amount);
      if (t.type === 'credit') totalCredits += amount;
      else totalDebits += amount;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Extracto Bancario</h1>
        <p className="text-sm text-gray-500 mt-1">Bancolombia — Cuenta de Ahorros</p>
      </div>

      <div className="px-8 py-6">
        <ExtractosMonthSelector months={availableMonths} selectedMonth={selectedMonth} />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Saldo Inicial</h3>
              <Wallet className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(openingBalance)}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Total Abonos</h3>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalCredits)}</p>
            <p className="text-xs text-gray-400 mt-1">{transactions.filter((t: any) => t.type === 'credit').length} movimientos</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Total Cargos</h3>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebits)}</p>
            <p className="text-xs text-gray-400 mt-1">{transactions.filter((t: any) => t.type === 'debit').length} movimientos</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Saldo Final</h3>
              <Landmark className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(closingBalance)}</p>
          </div>
        </div>

        {/* Statement Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 capitalize">
              {formatMonthTitle(selectedMonth)}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{transactions.length} movimientos</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Débito</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Crédito</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Categoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Saldo anterior */}
                <tr className="bg-amber-50">
                  <td className="px-4 py-3 text-sm text-gray-500" colSpan={5}>
                    <span className="font-medium text-gray-700">Saldo Anterior</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                    {formatCurrency(openingBalance)}
                  </td>
                  <td></td>
                </tr>

                {transactions.map((t: any, idx: number) => (
                  <tr key={t.id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                      {formatDateShort(t.date)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-900 max-w-xs truncate" title={t.description}>
                      {t.description}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                      {t.reference || ''}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-red-600 font-medium whitespace-nowrap">
                      {t.type === 'debit' ? formatCurrency(Number(t.amount)) : ''}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-green-600 font-medium whitespace-nowrap">
                      {t.type === 'credit' ? formatCurrency(Number(t.amount)) : ''}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                      {formatCurrency(Number(t.balance))}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <CategorySelector
                        transactionId={t.id}
                        currentCategory={t.category}
                        compact
                      />
                    </td>
                  </tr>
                ))}

                {/* Totales */}
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-sm font-medium text-gray-700" colSpan={3}>Saldo Final</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-red-700">{formatCurrency(totalDebits)}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-green-700">{formatCurrency(totalCredits)}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(closingBalance)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
