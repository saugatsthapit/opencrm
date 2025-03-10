import React, { useState, useEffect } from 'react';
import { Mail, Eye, MousePointer, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmailTrackingProps {
  leadSequenceId: string;
  stepId: string;
}

interface TrackingStats {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  lastOpened?: string;
  lastClicked?: string;
  clickedLinks: Array<{
    url: string;
    clicks: number;
    lastClicked: string;
  }>;
}

const EmailTracking: React.FC<EmailTrackingProps> = ({ leadSequenceId, stepId }) => {
  const [stats, setStats] = useState<TrackingStats>({
    sent: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    clickedLinks: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrackingStats();
  }, [leadSequenceId, stepId]);

  const fetchTrackingStats = async () => {
    try {
      // Get email tracking data
      const { data: tracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('lead_sequence_id', leadSequenceId)
        .eq('step_id', stepId);

      if (trackingError) throw trackingError;

      // Get link clicks
      const { data: clicks, error: clicksError } = await supabase
        .from('email_link_clicks')
        .select('*')
        .in('email_tracking_id', tracking?.map(t => t.id) || []);

      if (clicksError) throw clicksError;

      // Calculate stats
      const newStats: TrackingStats = {
        sent: tracking?.length || 0,
        opened: tracking?.filter(t => t.opened_at)?.length || 0,
        clicked: clicks?.length || 0,
        bounced: tracking?.filter(t => t.bounced_at)?.length || 0,
        lastOpened: tracking?.reduce((latest, t) => 
          !latest || (t.opened_at && t.opened_at > latest) ? t.opened_at : latest, 
          null as string | null
        ) || undefined,
        lastClicked: clicks?.reduce((latest, c) => 
          !latest || c.clicked_at > latest ? c.clicked_at : latest, 
          null as string | null
        ) || undefined,
        clickedLinks: Object.values(
          (clicks || []).reduce((acc, click) => {
            if (!acc[click.url]) {
              acc[click.url] = {
                url: click.url,
                clicks: 0,
                lastClicked: click.clicked_at
              };
            }
            acc[click.url].clicks++;
            if (click.clicked_at > acc[click.url].lastClicked) {
              acc[click.url].lastClicked = click.clicked_at;
            }
            return acc;
          }, {} as Record<string, { url: string; clicks: number; lastClicked: string }>)
        ).sort((a, b) => b.clicks - a.clicks)
      };

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching tracking stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-blue-600">
            <Mail className="h-5 w-5" />
            <span className="font-medium">Sent</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-blue-700">
            {stats.sent}
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-green-600">
            <Eye className="h-5 w-5" />
            <span className="font-medium">Opened</span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-semibold text-green-700">
              {stats.opened}
            </div>
            <div className="text-sm text-green-600">
              {((stats.opened / stats.sent) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-purple-600">
            <MousePointer className="h-5 w-5" />
            <span className="font-medium">Clicked</span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-semibold text-purple-700">
              {stats.clicked}
            </div>
            <div className="text-sm text-purple-600">
              {((stats.clicked / stats.sent) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Bounced</span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-semibold text-red-700">
              {stats.bounced}
            </div>
            <div className="text-sm text-red-600">
              {((stats.bounced / stats.sent) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {stats.clickedLinks.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Clicked Links</h4>
          <div className="space-y-2">
            {stats.clickedLinks.map((link) => (
              <div
                key={link.url}
                className="bg-gray-50 p-3 rounded-lg flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {link.url}
                  </div>
                  <div className="text-sm text-gray-500">
                    Last clicked {new Date(link.lastClicked).toLocaleDateString()}
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
      )}

      <div className="text-sm text-gray-500 mt-4">
        {stats.lastOpened && (
          <div>Last opened: {new Date(stats.lastOpened).toLocaleString()}</div>
        )}
        {stats.lastClicked && (
          <div>Last clicked: {new Date(stats.lastClicked).toLocaleString()}</div>
        )}
      </div>
    </div>
  );
};

export default EmailTracking;