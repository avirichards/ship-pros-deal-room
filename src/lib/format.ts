export function formatSpend(val: string | null | undefined): string {
  if (!val) return '—';
  const clean = val.replace(/,/g, '');
  if (/^\$?\d+(\.\d{1,2})?$/.test(clean)) {
    const num = Number(clean.replace('$', ''));
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  }
  return val.startsWith('$') ? val : `$${val}`;
}

export function formatVolume(val: string | null | undefined): string {
  if (!val) return '—';
  const clean = val.replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(clean)) {
    const num = Number(clean);
    return new Intl.NumberFormat('en-US').format(num);
  }
  return val;
}
