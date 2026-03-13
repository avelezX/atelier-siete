import { atelierTableAdmin } from './supabase';

export interface CategorizationRule {
  pattern: string;
  categoryName: string;
  priority: number;
}

export async function fetchCategorizationRules(): Promise<CategorizationRule[]> {
  const { data: rules, error } = await atelierTableAdmin('auto_rules')
    .select('pattern, priority, category_id')
    .eq('active', true)
    .eq('applies_to', 'transaction')
    .order('priority', { ascending: false });

  if (error || !rules || rules.length === 0) {
    return [];
  }

  const { data: categories } = await atelierTableAdmin('categories')
    .select('id, name');

  const catMap = new Map<string, string>();
  for (const cat of categories || []) {
    catMap.set(cat.id, cat.name);
  }

  return rules
    .map((r: any) => ({
      pattern: r.pattern,
      categoryName: catMap.get(r.category_id) || '',
      priority: r.priority,
    }))
    .filter((r: CategorizationRule) => r.categoryName !== '');
}

function buildRegex(pattern: string): RegExp | null {
  const cleanPattern = pattern.replace(/^\(\?i\)/, '');
  try {
    return new RegExp(cleanPattern, 'i');
  } catch {
    return null;
  }
}

export function categorizeTransaction(
  description: string,
  rules: CategorizationRule[]
): string | null {
  for (const rule of rules) {
    const regex = buildRegex(rule.pattern);
    if (regex && regex.test(description)) {
      return rule.categoryName;
    }
  }
  return null;
}
