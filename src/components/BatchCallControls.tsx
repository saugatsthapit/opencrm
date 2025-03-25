import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { List, PhoneOutgoing, Info } from "lucide-react";

interface BatchCallResult {
  lead_id: string;
  success: boolean;
  queued: boolean;
  error?: string;
}

interface BatchCallControlsProps {
  selectedLeads: string[];
  batchCallInProgress: boolean;
  currentBatchIndex: number;
  totalLeads: number;
  currentLeadName: string;
  loading: boolean;
  onStartBatch: () => Promise<void>;
  onCallNext: () => Promise<void>;
  batchResults: BatchCallResult[];
  getLeadName: (leadId: string) => string;
}

export default function BatchCallControls({
  selectedLeads,
  batchCallInProgress,
  currentBatchIndex,
  totalLeads,
  currentLeadName,
  loading,
  onStartBatch,
  onCallNext,
  batchResults,
  getLeadName
}: BatchCallControlsProps) {
  return (
    <div className="space-y-4">
      {batchCallInProgress ? (
        <div>
          <Alert className="mb-4 bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertTitle>Batch Calling In Progress</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                Currently calling lead {currentBatchIndex + 1} of {totalLeads}
              </p>
              <p>
                Current Lead: {currentLeadName}
              </p>
            </AlertDescription>
          </Alert>

          <Button
            onClick={onCallNext}
            disabled={loading || currentBatchIndex >= totalLeads - 1}
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Calling Next...
              </>
            ) : (
              <>
                <PhoneOutgoing className="mr-2 h-4 w-4" />
                Call Next Lead
              </>
            )}
          </Button>
        </div>
      ) : (
        <Button
          onClick={onStartBatch}
          disabled={loading || selectedLeads.length === 0}
          className="w-full md:w-auto"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <List className="mr-2 h-4 w-4" />
              Start Batch Calling ({selectedLeads.length} leads)
            </>
          )}
        </Button>
      )}

      {batchResults.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium mb-2">Batch Call Results:</h4>
          <ul className="divide-y divide-gray-200 border rounded">
            {batchResults.map((result, index) => (
              <li key={index} className="p-3">
                <div className="flex items-center">
                  {result.success ? (
                    <Info className="h-4 w-4 text-green-500 mr-2" />
                  ) : (
                    <Info className="h-4 w-4 text-red-500 mr-2" />
                  )}
                  <p className="text-sm">
                    Lead: {getLeadName(result.lead_id)} - 
                    Status: {result.queued ? 'Queued' : result.success ? 'Called' : 'Failed'}
                    {result.error && ` - Error: ${result.error}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 