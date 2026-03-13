'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Category {
  id: string;
  name: string;
  type: string;
  color: string | null;
  parent_id: string | null;
}

interface Props {
  transactionId: string;
  currentCategory: string | null;
  compact?: boolean;
}

let cachedCategories: Category[] | null = null;
let cachePromise: Promise<Category[]> | null = null;

function fetchCategoriesOnce(): Promise<Category[]> {
  if (cachedCategories) return Promise.resolve(cachedCategories);
  if (cachePromise) return cachePromise;

  cachePromise = fetch('/api/categories')
    .then(res => res.json())
    .then(data => {
      cachedCategories = data.categories || [];
      return cachedCategories!;
    })
    .catch(() => {
      cachePromise = null;
      return [];
    });

  return cachePromise;
}

export function invalidateCategoryCache() {
  cachedCategories = null;
  cachePromise = null;
}

export default function CategorySelector({ transactionId, currentCategory, compact }: Props) {
  const [category, setCategory] = useState(currentCategory || '');
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchCategoriesOnce().then(setCategories);
  }, []);

  const current = categories.find(c => c.name === category);
  const parents = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);
  const orphans = categories.filter(c => c.parent_id && !parents.find(p => p.id === c.parent_id));

  const handleChange = async (newCategory: string) => {
    setCategory(newCategory);
    setSaving(true);
    try {
      await fetch(`/api/transactions/${transactionId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory || null }),
      });
      router.refresh();
    } catch {
      setCategory(currentCategory || '');
    } finally {
      setSaving(false);
    }
  };

  const selectClass = compact
    ? 'text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:ring-1 focus:ring-amber-500 focus:border-transparent max-w-[150px] disabled:opacity-50'
    : 'text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50';

  const renderOptions = () => {
    if (parents.length > 0) {
      return (
        <>
          {parents.map((parent) => {
            const children = getChildren(parent.id);
            if (children.length === 0) return null;
            return (
              <optgroup key={parent.id} label={parent.name}>
                {children.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </optgroup>
            );
          })}
          {orphans.length > 0 && (
            <optgroup label="Otras">
              {orphans.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
          )}
        </>
      );
    }
    return (
      <>
        <optgroup label="Ingresos">
          {categories.filter(c => c.type === 'income').map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </optgroup>
        <optgroup label="Gastos">
          {categories.filter(c => c.type === 'expense').map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </optgroup>
        <optgroup label="Impuestos">
          {categories.filter(c => c.type === 'tax').map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </optgroup>
      </>
    );
  };

  return (
    <select
      value={category}
      title="Cambiar categoria"
      onChange={(e) => handleChange(e.target.value)}
      disabled={saving}
      className={selectClass}
      style={current?.color ? { borderLeftColor: current.color, borderLeftWidth: 3 } : {}}
    >
      <option value="">Sin categoria</option>
      {renderOptions()}
    </select>
  );
}
