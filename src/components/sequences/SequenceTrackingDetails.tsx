import React, { useState, useEffect } from 'react';
import { Mail, Eye, MousePointer, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StepStats {
  step_id: string;
  step_type: string;
  step_order: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  clicked_links: Array<{
    url: string;
    clicks: number;
    last_clicked: string;
  }>;
}

interface SequenceTrackingDetailsProps {
  sequenceId: string;
  sequenceName: string;
}

const SequenceTrackingDetails: React.FC<SequenceTrackingDetailsProps> = ({
  sequenceId,
  sequenceName
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepStats, setStepStats] = useState<StepStats[]>([]);

  useEffect(() => {
    if (expanded && stepStats.length === 0) {
      fetchStepStats();
    }
  }, [expanded]);

  const fetchStepStats = async () => {
    try {
      setLoading(true);

      // Get sequence steps
      const { data: steps, error: stepsError } = await supabase
        .from('sequence_steps')
        .select('*')
        .eq('sequence_id', sequenceId)
        .order('step_order');

      if (stepsError) throw stepsError;

      // Get tracking data for each step
      const { data: tracking, error: trackingError } = await supabase
        .from('email_tracking')
        .select(`
          id,
          step_id,
          sent_at,
          opened_at,
          bounced_at,
          bounce_reason
        `)
        .eq('lead_sequence:lead_sequences!inner(sequence_id)', sequenceId);

      if (trackingError) throw trackingError;

      // Get link clicks
      const { data: clicks, error: clicksError } = await supabase
        .from('email_link_clicks')
        .select('*')
        .in('email_tracking_id', tracking?.map(t => t.id) || []);

      if (clicksError) throw clicksError;

      // Calculate stats for each step
      const stats = (steps || []).map(step => {
        const stepTracking = tracking?.filter(t => t.step_id === step.id) || [];
        const stepClicks = clicks?.filter(c => 
          stepTracking.some(t => t.id === c.email_tracking_id)
        ) || [];

        const sent = stepTracking.length;
        const opened = stepTracking.filter(t => t.opened_at).length;
        const clicked = new Set(stepClicks.map(c => c.email_tracking_id)).size;
        const bounced = stepTracking.filter(t => t.bounced_at).length;

        // Calculate clicked links stats
        const clickedLinks = Object.values(
          stepClicks.reduce((acc, click) => {
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
          }, {} as Record<string, { url: string; clicks: number; last_clicked: string }>)
        ).sort((a, b) => b.clicks - a.clicks);

        return {
          step_id: step.id,
          step_type: step.step_type,
          step_order: step.step_order,
          sent,
          opened,
          clicked,
          bounced,
          open_rate: sent > 0 ? (opened / sent) * 100 : 0,
          click_rate: sent > 0 ? (clicked / sent) * 100 : 0,
          bounce_rate: sent > 0 ? (bounced / sent) * 100 : 0,
          clicked_links
        };
      });

      setStepStats(stats);
    } catch (error) {
      console.error('Error fetching step stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-gray-400" />
          <div>
            <h3 className="font-medium text-gray-900">{sequenceName}</h3>
            <p className="text-sm text-gray-500">
              {stepStats.length} steps
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {stepStats.map((stats) => (
                <div key={stats.step_id} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">
                      Step {stats.step_order + 1}: {stats.step_type}
                    </h4>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="flex items-center gap-2 text-blue-600">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm font-medium">Sent</span>
                      </div>
                      <div className="mt-1 text-xl font-semibold text-blue-700">
                        {stats.sent}
                      </div>
                    </div>

                    <div className="bg-green-50 p-3 rounded">
                      <div className="flex items-center gap-2 text-green-600">
                        <Eye className="h-4 w-4" />
                        <span className="text-sm font-medium">Opens</span>
                      </div>
                      <div className="mt-1">
                        <div className="text-xl font-semibold text-green-700">
                          {stats.opened}
                        </div>
                        <div className="text-xs text-green-600">
                          {stats.open_rate.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-3 rounded">
                      <div className="flex items-center gap-2 text-purple-600">
                        <MousePointer className="h-4 w-4" />
                        <span className="text-sm font-medium">Clicks</span>
                      </div>
                      <div className="mt-1">
                        <div className="text-xl font-semibold text-purple-700">
                          {stats.clicked}
                        </div>
                        <div className="text-xs text-purple-600">
                          {stats.click_rate.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 p-3 rounded">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Bounces</span>
                      </div>
                      <div className="mt-1">
                        <div className="text-xl font-semibold text-red-700">
                          {stats.bounced}
                        </div>
                        <div className="text-xs text-red-600">
                          {stats.bounce_rate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {stats.clicked_links.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">
                        Clicked Links
                      </h5>
                      <div className="space-y-2">
                        {stats.clicked_links.map((link, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {link.url}
                              </div>
                              <div className="text-gray-500">
                                Last clicked {new Date(link.last_clicked).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="font-semibold text-gray-900">
                                {link.clicks}
                              </div>
                              <div className="text-gray-500">clicks</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SequenceTrackingDetails;