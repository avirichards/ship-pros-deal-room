import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Opportunity } from '../../lib/types';
import { Package, Calendar, Clock, Truck, DollarSign, LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, Globe } from 'lucide-react';
import { formatSpend, formatVolume } from '../../lib/format';

type SortKey = 'name' | 'annual_volume' | 'annual_parcel_volume' | 'fulfillment_type' | 'deadline' | 'created_at' | 'carriers' | 'shipping_scope';
type SortDir = 'asc' | 'desc';
type ViewMode = 'tiles' | 'table';

export default function VendorDashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('vendor-view-mode') as ViewMode;
    if (saved) return saved;
    // Default to tiles on mobile, table on desktop
    return window.innerWidth < 768 ? 'tiles' : 'table';
  });
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const navigate = useNavigate();

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    localStorage.setItem('vendor-view-mode', viewMode);
  }, [viewMode]);

  async function fetchOpportunities() {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setOpportunities(data as Opportunity[]);
    setLoading(false);
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const getDeadlineDisplay = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: 'Expired', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (diff <= 3) return { text: `${diff}d left`, color: 'text-amber-600', bgColor: 'bg-amber-50' };
    if (diff <= 7) return { text: `${diff}d left`, color: 'text-blue-600', bgColor: 'bg-blue-50' };
    return { text: formatDate(deadline), color: 'text-gray-600', bgColor: 'bg-gray-50' };
  };

  // Parse a dollar/number string into a numeric value for sorting
  const parseNumeric = (val: string | null | undefined): number => {
    if (!val) return 0;
    const clean = val.replace(/[$,\s]/g, '').toLowerCase();
    if (clean.endsWith('k')) return Number(clean.slice(0, -1)) * 1000;
    if (clean.endsWith('m')) return Number(clean.slice(0, -1)) * 1000000;
    return Number(clean) || 0;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'created_at' ? 'desc' : 'asc');
    }
  };

  const sorted = [...opportunities].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'name':
        return dir * a.name.localeCompare(b.name);
      case 'annual_volume':
        return dir * (parseNumeric(a.annual_volume) - parseNumeric(b.annual_volume));
      case 'annual_parcel_volume':
        return dir * (parseNumeric(a.annual_parcel_volume) - parseNumeric(b.annual_parcel_volume));
      case 'fulfillment_type':
        return dir * (a.fulfillment_type || '').localeCompare(b.fulfillment_type || '');
      case 'deadline': {
        const da = a.deadline ? new Date(a.deadline).getTime() : 0;
        const db = b.deadline ? new Date(b.deadline).getTime() : 0;
        return dir * (da - db);
      }
      case 'created_at':
        return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'carriers':
        return dir * (a.carriers || []).join(', ').localeCompare((b.carriers || []).join(', '));
      case 'shipping_scope':
        return dir * ((Array.isArray(a.shipping_scope) ? a.shipping_scope : []).join(', ')).localeCompare((Array.isArray(b.shipping_scope) ? b.shipping_scope : []).join(', '));
      default:
        return 0;
    }
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-teal-500" />
      : <ArrowDown className="w-3 h-3 text-teal-500" />;
  };

  const ThButton = ({ column, children }: { column: SortKey; children: React.ReactNode }) => (
    <th className="px-4 py-3">
      <button
        onClick={() => handleSort(column)}
        className="inline-flex items-center gap-1 text-left font-semibold hover:text-teal-600 transition-colors"
      >
        {children}
        <SortIcon column={column} />
      </button>
    </th>
  );

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Open Opportunities</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('tiles')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'tiles' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Tile View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'table' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No opportunities available</h3>
          <p className="text-sm text-gray-500">Check back later for new shipping opportunities</p>
        </div>
      ) : viewMode === 'tiles' ? (
        /* ───── Tile View ───── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sorted.map(opp => {
            const deadlineInfo = getDeadlineDisplay(opp.deadline);
            return (
              <Link
                key={opp.id}
                to={`/vendor/opportunities/${opp.id}`}
                className="card p-6 hover:shadow-md transition-shadow duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-navy-950 group-hover:text-teal-500 transition-colors">
                    {opp.name}
                  </h3>
                  {deadlineInfo && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${deadlineInfo.color} ${deadlineInfo.bgColor}`}>
                      <Clock className="w-3 h-3" />
                      {deadlineInfo.text}
                    </span>
                  )}
                </div>

                {opp.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{opp.description}</p>
                )}

                {/* Carriers */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {opp.carriers.map(c => (
                    <span key={c} className="badge-carrier">{c}</span>
                  ))}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {formatSpend(opp.annual_volume)}
                  </span>
                  {opp.annual_parcel_volume && (
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {formatVolume(opp.annual_parcel_volume)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    {opp.fulfillment_type}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(opp.created_at)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ───── Table View ───── */
        <div className="table-container" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full" style={{ minWidth: '800px' }}>
            <thead>
              <tr className="table-header">
                <ThButton column="name">Opportunity</ThButton>
                <ThButton column="carriers">Carriers</ThButton>
                <ThButton column="annual_volume">Annual Spend (est)</ThButton>
                <ThButton column="annual_parcel_volume">Parcel Volume (est)</ThButton>
                <ThButton column="fulfillment_type">Fulfillment</ThButton>
                <ThButton column="shipping_scope">Region</ThButton>
                <ThButton column="deadline">Deadline</ThButton>
                <ThButton column="created_at">Created</ThButton>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map(opp => {
                const deadlineInfo = getDeadlineDisplay(opp.deadline);
                return (
                  <tr
                    key={opp.id}
                    onClick={() => navigate(`/vendor/opportunities/${opp.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-navy-950">{opp.name}</div>
                      {opp.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{opp.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {opp.carriers.map(c => (
                          <span key={c} className="badge-carrier">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatSpend(opp.annual_volume)}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatVolume(opp.annual_parcel_volume)}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{opp.fulfillment_type}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {Array.isArray(opp.shipping_scope) ? opp.shipping_scope.join(', ') : (opp.shipping_scope || '—')}
                    </td>
                    <td className="px-4 py-4">
                      {deadlineInfo ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${deadlineInfo.color} ${deadlineInfo.bgColor}`}>
                          <Clock className="w-3 h-3" />
                          {deadlineInfo.text}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDate(opp.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
