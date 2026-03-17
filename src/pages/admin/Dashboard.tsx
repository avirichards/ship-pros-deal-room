import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Opportunity, OpportunityStatus, STATUSES } from '../../lib/types';
import { Plus, FileText, Users, Calendar, Clock, Upload } from 'lucide-react';

const statusBadgeClass: Record<OpportunityStatus, string> = {
  'Open': 'badge-open',
  'Quoted': 'badge-quoted',
  'Closed/Won': 'badge-won',
  'Closed/Lost': 'badge-lost',
};

export default function AdminDashboard() {
  const [opportunities, setOpportunities] = useState<(Opportunity & { file_count: number; interest_count: number; submission_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | OpportunityStatus>('All');
  const navigate = useNavigate();

  useEffect(() => {
    fetchOpportunities();
  }, []);

  async function fetchOpportunities() {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        opportunity_files(count),
        vendor_interest(count),
        vendor_submissions(vendor_id)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((opp: any) => ({
        ...opp,
        file_count: opp.opportunity_files?.[0]?.count ?? 0,
        interest_count: opp.vendor_interest?.[0]?.count ?? 0,
        submission_count: new Set((opp.vendor_submissions || []).map((s: any) => s.vendor_id)).size,
      }));
      setOpportunities(mapped);
    }
    setLoading(false);
  }

  const filtered = filter === 'All'
    ? opportunities
    : opportunities.filter(o => o.status === filter);

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const getDeadlineDisplay = (deadline: string | null) => {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diff = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return <span className="text-red-600 text-xs font-medium">Expired</span>;
    if (diff <= 3) return <span className="text-amber-600 text-xs font-medium">{diff}d left</span>;
    return <span className="text-gray-500 text-xs">{formatDate(deadline)}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Opportunities</h1>
        <Link to="/admin/opportunities/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Opportunity
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {['All', ...STATUSES].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-white text-navy-950 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No opportunities yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create your first opportunity to get started</p>
          <Link to="/admin/opportunities/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Opportunity
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-6 py-3">Opportunity</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Deadline</th>
                <th className="px-6 py-3">Volume</th>
                <th className="px-6 py-3">Files</th>
                <th className="px-6 py-3">Interested</th>
                <th className="px-6 py-3">Submissions</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(opp => (
                <tr 
                  key={opp.id} 
                  onClick={() => navigate(`/admin/opportunities/${opp.id}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-navy-950">
                      {opp.name}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {opp.carriers.map(c => (
                        <span key={c} className="badge-carrier">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={statusBadgeClass[opp.status]}>{opp.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {opp.deadline && <Clock className="w-3.5 h-3.5 text-gray-400" />}
                      {getDeadlineDisplay(opp.deadline)}
                      {!opp.deadline && <span className="text-gray-400 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{opp.annual_volume || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <FileText className="w-3.5 h-3.5" />
                      {opp.file_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Users className="w-3.5 h-3.5" />
                      {opp.interest_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Upload className="w-3.5 h-3.5" />
                      {opp.submission_count}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(opp.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
