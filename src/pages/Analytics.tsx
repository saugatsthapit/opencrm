import React, { useState, useEffect } from 'react';
import { Mail, Eye, MousePointer, AlertTriangle, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SequenceTrackingDetails from '../components/sequences/SequenceTrackingDetails';

interface EmailStats {
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  sequences: Array<{
    id: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
  }>;
  top_clicked_links: Array<{
    url: string;
    clicks: number;
    last_clicked: string;
  }>;
  recent_activity: Array<{
    type: 'open' | 'click' | 'bounce';
    email: string;
    timestamp: string;
    details?: string;
  }>;
}

const Analytics = () => {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'sent' | 'open_rate' | 'click_rate'>('sent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchEmailStats();
  }, []);

  const fetchEmailStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all email tracking data
      const { data: tracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select(`
          id,
          email,
          subject,
          sent_at,
          opened_at,
          bounced_at,
          bounce_reason,
          lead_sequence:lead_sequences!inner(
            sequence:sequences!inner(
              id,
              name
            )
          )
        `);

      if (trackingError) throw trackingError;

      // Get all link clicks
      const { data: clicks, error: clicksError } = await supabase
        .from('email_link_clicks')
        .select('*');

      if (clicksError) throw clicksError;

      // Process sequence-level stats
      const sequenceStats = (tracking || []).reduce((acc, email) => {
        const sequenceId = email.lead_sequence.sequence.id;
        const sequenceName = email.lead_sequence.sequence.name;
        
        if (!acc[sequenceId]) {
          acc[sequenceId] = {
            id: sequenceId,
            name: sequenceName,
            sent: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            open_rate: 0,
            click_rate: 0,
            bounce_rate: 0
          };
        }

        acc[sequenceId].sent++;
        if (email.opened_at) acc[sequenceId].opened++;
        if (email.bounced_at) acc[sequenceId].bounced++;
        
        // Count clicks for this email
        const emailClicks = (clicks || []).filter(click => 
          click.email_tracking_id === email.id
        ).length;
        if (emailClicks > 0) acc[sequenceId].clicked++;

        return acc;
      }, {} as Record<string, EmailStats['sequences'][0]>);

      // Calculate rates for each sequence
      Object.values(sequenceStats).forEach(sequence => {
        sequence.open_rate = sequence.sent > 0 ? (sequence.opened / sequence.sent) * 100 : 0;
        sequence.click_rate = sequence.sent > 0 ? (sequence.clicked / sequence.sent) * 100 : 0;
        sequence.bounce_rate = sequence.sent > 0 ? (sequence.bounced / sequence.sent) * 100 : 0;
      });

      // Process top clicked links
      const linkStats = (clicks || []).reduce((acc, click) => {
        if (!acc[click.url]) {
          acc[click.url] = {
            url: click.url,
            clicks: 0,
            last_clicked: click.clicked_at
          };
        }
        acc[click.url].clicks++;
        if (click.clicked_at > acc[click.url].last_clicked) {
          acc[click.url].last_clicked = click.clicked_at;
        }
        return acc;
      }, {} as Record<string, EmailStats['top_clicked_links'][0]>);

      // Get recent activity
      const recentActivity = [...(tracking || [])]
        .filter(email => email.opened_at || email.bounced_at)
        .map(email => ({
          type: email.bounced_at ? 'bounce' as const : 'open' as const,
          email: email.email,
          timestamp: email.bounced_at || email.opened_at || '',
          details: email.bounce_reason
        }))
        .concat(
          (clicks || []).map(click => ({
            type: 'click' as const,
            email: tracking?.find(t => t.id === click.email_tracking_id)?.email || '',
            timestamp: click.clicked_at,
            details: click.url
          }))
        )
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      // Calculate overall stats
      const totalSent = tracking?.length || 0;
      const totalOpened = tracking?.filter(t => t.opened_at)?.length || 0;
      const totalClicked = new Set(clicks?.map(c => c.email_tracking_id)).size;
      const totalBounced = tracking?.filter(t => t.bounced_at)?.length || 0;

      const totalStats: EmailStats = {
        total_sent: totalSent,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        total_bounced: totalBounced,
        open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        click_rate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        bounce_rate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
        sequences: Object.values(sequenceStats),
        top_clicked_links: Object.values(linkStats).sort((a, b) => b.clicks - a.clicks).slice(0, 10),
        recent_activity: recentActivity
      };

      setStats(totalStats);
    } catch (error) {
      console.error('Error fetching email stats:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedSequences = () => {
    if (!stats) return [];
    return [...stats.sequences].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return (a[sortField] - b[sortField]) * multiplier;
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-lg"></div>
        <div className="h-64 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Email Analytics</h1>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-sm hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 p-6 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600">
                <Mail className="h-5 w-5" />
                <span className="font-medium">Total Sent</span>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-semibold text-blue-700">
                  {stats.total_sent}
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex items-center gap-2 text-green-600">
                <Eye className="h-5 w-5" />
                <span className="font-medium">Opens</span>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-semibold text-green-700">
                  {stats.total_opened}
                </div>
                <div className="text-sm text-green-600">
                  {stats.open_rate.toFixed(1)}% open rate
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg">
              <div className="flex items-center gap-2 text-purple-600">
                <MousePointer className="h-5 w-5" />
                <span className="font-medium">Clicks</span>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-semibold text-purple-700">
                  {stats.total_clicked}
                </div>
                <div className="text-sm text-purple-600">
                  {stats.click_rate.toFixed(1)}% click rate
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-6 rounded-lg">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Bounces</span>
              </div>
              <div className="mt-2">
                <div className="text-3xl font-semibold text-red-700">
                  {stats.total_bounced}
                </div>
                <div className="text-sm text-red-600">
                  {stats.bounce_rate.toFixed(1)}% bounce rate
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Sequence Performance</h2>
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-3">Sequence</th>
                    <th className="pb-3 cursor-pointer" onClick={() => toggleSort('sent')}>
                      <div className="flex items-center gap-1">
                        Sent
                        {sortField === 'sent' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="pb-3 cursor-pointer" onClick={() => toggleSort('open_rate')}>
                      <div className="flex items-center gap-1">
                        Open Rate
                        {sortField === 'open_rate' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="pb-3 cursor-pointer" onClick={() => toggleSort('click_rate')}>
                      <div className="flex items-center gap-1">
                        Click Rate
                        {sortField === 'click_rate' && (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="pb-3">Bounce Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedSequences().map(sequence => (
                    <tr key={sequence.id} className="border-b last:border-0">
                      <td className="py-3">{sequence.name}</td>
                      <td className="py-3">{sequence.sent}</td>
                      <td className="py-3">{sequence.open_rate.toFixed(1)}%</td>
                      <td className="py-3">{sequence.click_rate.toFixed(1)}%</td>
                      <td className="py-3">{sequence.bounce_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Sequence Details</h2>
            <div className="space-y-4">
              {getSortedSequences().map(sequence => (
                <SequenceTrackingDetails
                  key={sequence.id}
                  sequenceId={sequence.id}
                  sequenceName={sequence.name}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Top Clicked Links</h2>
                <div className="space-y-3">
                  {stats.top_clicked_links.map(link => (
                    <div key={link.url} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {link.url}
                        </div>
                        <div className="text-sm text-gray-500">
                          Last clicked {new Date(link.last_clicked).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-lg font-semibold text-gray-900">
                          {link.clicks}
                        </div>
                        <div className="text-sm text-gray-500">clicks</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                <div className="space-y-3">
                  {stats.recent_activity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      {activity.type === 'open' && <Eye className="h-5 w-5 text-green-600" />}
                      {activity.type === 'click' && <MousePointer className="h-5 w-5 text-purple-600" />}
                      {activity.type === 'bounce' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {activity.email}
                        </div>
                        <div className="text-sm text-gray-500">
                          {activity.type === 'open' && 'Opened email'}
                          {activity.type === 'click' && `Clicked: ${activity.details}`}
                          {activity.type === 'bounce' && `Bounced: ${activity.details || 'Unknown reason'}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;