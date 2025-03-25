import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone?: string;
  mobile_phone1?: string | null;
  mobile_phone2?: string | null;
  called?: boolean;
}

interface LeadSelectorProps {
  leads: Lead[];
  mode: 'single' | 'batch';
  selectedLeads: string[];
  onLeadSelect: (leadId: string) => void;
  onLeadToggle?: (leadId: string) => void;
  loading?: boolean;
}

export default function LeadSelector({
  leads,
  mode,
  selectedLeads,
  onLeadSelect,
  onLeadToggle,
  loading = false
}: LeadSelectorProps) {
  if (loading && leads.length === 0) {
    return <p className="text-gray-500">Loading leads...</p>;
  }

  if (leads.length === 0) {
    return <p className="text-gray-500">No leads found. Please add some leads first.</p>;
  }

  return (
    <div className="border rounded-md p-2 max-h-60 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {mode === 'batch' && <TableHead className="w-[50px]">Select</TableHead>}
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow 
              key={lead.id}
              className={`cursor-pointer hover:bg-gray-50 ${
                selectedLeads.includes(lead.id) ? 'bg-blue-50' : ''
              }`}
              onClick={() => mode === 'single' ? onLeadSelect(lead.id) : undefined}
            >
              {mode === 'batch' && (
                <TableCell>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={() => onLeadToggle?.(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
              )}
              <TableCell>
                {lead.first_name} {lead.last_name}
                {lead.company_name && (
                  <div className="text-sm text-gray-500">{lead.company_name}</div>
                )}
              </TableCell>
              <TableCell>
                {lead.mobile_phone1 || lead.phone || 'No phone'}
                {lead.mobile_phone2 && (
                  <div className="text-sm text-gray-500">{lead.mobile_phone2}</div>
                )}
              </TableCell>
              <TableCell>
                {lead.called ? (
                  <Badge variant="success">Called</Badge>
                ) : selectedLeads.includes(lead.id) ? (
                  <Badge variant="secondary">Selected</Badge>
                ) : (
                  <Badge variant="outline">Not Called</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 