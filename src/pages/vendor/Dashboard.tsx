import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Opportunity } from '../../lib/types';
import { Package, Calendar, Clock, Truck } from 'lucide-react';

export default function VendorDashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpportunities();
  }, []);

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Open Opportunities</h1>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {opportunities.map(opp => {
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
                    <Package className="w-3.5 h-3.5" />
                    {opp.annual_volume || 'N/A'}
                  </span>
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
      )}
    </div>
  );
}
