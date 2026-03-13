'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  months: string[];
  selectedMonth: string;
}

function formatMonthLabel(m: string): string {
  const d = new Date(m + '-15');
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' });
}

export default function ExtractosMonthSelector({ months, selectedMonth }: Props) {
  const currentIndex = months.indexOf(selectedMonth);
  const hasNewer = currentIndex > 0;
  const hasOlder = currentIndex < months.length - 1;

  const navigate = (month: string) => {
    window.location.href = `/bancos/extractos?month=${month}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => hasOlder && navigate(months[currentIndex + 1])}
          disabled={!hasOlder}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 hover:bg-gray-100"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>

        <select
          value={selectedMonth}
          title="Seleccionar mes"
          onChange={(e) => navigate(e.target.value)}
          className="px-4 py-2 text-sm font-semibold text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent capitalize"
        >
          {months.map((m) => (
            <option key={m} value={m} className="capitalize">
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>

        <button
          onClick={() => hasNewer && navigate(months[currentIndex - 1])}
          disabled={!hasNewer}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 hover:bg-gray-100"
        >
          Siguiente
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
