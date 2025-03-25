import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PhoneNumberInputProps {
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  customPhone: string;
  onPhoneChange: (phone: string) => void;
  required?: boolean;
}

export default function PhoneNumberInput({
  primaryPhone,
  secondaryPhone,
  customPhone,
  onPhoneChange,
  required = true
}: PhoneNumberInputProps) {
  // Format a phone number to E.164 format (+country code and only digits)
  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // If the number already starts with a +, just return it with non-digits removed
    if (phone.startsWith('+')) {
      return '+' + digitsOnly;
    }
    
    // If it starts with a 1 (US), add + prefix
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
      return '+' + digitsOnly;
    }
    
    // If it's a 10-digit number (assuming US), add +1 prefix
    if (digitsOnly.length === 10) {
      return '+1' + digitsOnly;
    }
    
    // For any other format, just add + prefix
    return '+' + digitsOnly;
  };

  return (
    <div className="space-y-2">
      {primaryPhone && (
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="phone1"
            name="phone"
            value={primaryPhone}
            checked={customPhone === primaryPhone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhoneChange(e.target.value)}
            className="text-blue-600"
          />
          <Label htmlFor="phone1" className="text-sm">
            Primary: {primaryPhone}
          </Label>
        </div>
      )}
      
      {secondaryPhone && (
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="phone2"
            name="phone"
            value={secondaryPhone}
            checked={customPhone === secondaryPhone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhoneChange(e.target.value)}
            className="text-blue-600"
          />
          <Label htmlFor="phone2" className="text-sm">
            Secondary: {secondaryPhone}
          </Label>
        </div>
      )}
      
      <div className="mt-2">
        <Input
          type="tel"
          id="customPhone"
          className={`w-full ${!customPhone && required ? 'border-red-300 bg-red-50' : ''}`}
          value={customPhone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhoneChange(e.target.value)}
          placeholder="+1234567890"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500 mt-1">
            Enter phone number in international format (e.g., +1234567890)
          </p>
          <div className="bg-blue-50 text-xs text-blue-700 p-1 px-2 rounded mt-1">
            Phone will be formatted as: {customPhone ? formatPhoneNumber(customPhone) : '+1XXXXXXXXXX'}
          </div>
        </div>
        {!customPhone && required && (
          <p className="text-sm text-red-500 mt-1">
            Please enter a phone number
          </p>
        )}
      </div>
    </div>
  );
} 