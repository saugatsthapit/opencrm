import { Button } from "@/components/ui/button";
import { PhoneCall } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";

interface CallResult {
  call_id: string;
  status: string;
  tracking_id?: string;
}

interface CallControlsProps {
  onCall: () => Promise<void>;
  loading: boolean;
  disabled: boolean;
  callResult: CallResult | null;
  error: string | null;
}

export default function CallControls({
  onCall,
  loading,
  disabled,
  callResult,
  error
}: CallControlsProps) {
  return (
    <div className="space-y-4">
      <Button
        onClick={onCall}
        disabled={loading || disabled}
        className="w-full md:w-auto"
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Placing Call...
          </>
        ) : (
          <>
            <PhoneCall className="mr-2 h-4 w-4" />
            Place Call
          </>
        )}
      </Button>

      {callResult && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle>Call Initiated!</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p><strong>Call ID:</strong> {callResult.call_id}</p>
              <p><strong>Status:</strong> {callResult.status}</p>
              {callResult.tracking_id && (
                <p><strong>Tracking ID:</strong> {callResult.tracking_id}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
} 