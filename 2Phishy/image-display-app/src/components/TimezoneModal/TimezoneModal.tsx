import React, { useState } from 'react';
import { useTimezone } from '../../contexts/TimezoneContext';
import './TimezoneModal.scss';

interface TimezoneOption {
  value: string;
  label: string;
  displayName: string;
}

const timezoneOptions: TimezoneOption[] = [
  { value: 'Asia/Manila', label: 'PHT', displayName: 'Philippine Time' },
  { value: 'Asia/Singapore', label: 'SGT', displayName: 'Singapore Time' },
  { value: 'Asia/Hong_Kong', label: 'HKT', displayName: 'Hong Kong Time' },
  { value: 'Asia/Tokyo', label: 'JST', displayName: 'Japan Standard Time' },
  { value: 'Asia/Seoul', label: 'KST', displayName: 'Korea Standard Time' },
  { value: 'Asia/Shanghai', label: 'CST', displayName: 'China Standard Time' },
  { value: 'Asia/Bangkok', label: 'ICT', displayName: 'Indochina Time' },
  { value: 'Asia/Jakarta', label: 'WIB', displayName: 'Western Indonesia Time' },
  { value: 'Asia/Kuala_Lumpur', label: 'MYT', displayName: 'Malaysia Time' },
  { value: 'Asia/Taipei', label: 'CST', displayName: 'Taiwan Time' },
  { value: 'Asia/Kolkata', label: 'IST', displayName: 'India Standard Time' },
  { value: 'Asia/Dubai', label: 'GST', displayName: 'Gulf Standard Time' },
  { value: 'Europe/London', label: 'GMT', displayName: 'Greenwich Mean Time' },
  { value: 'Europe/Paris', label: 'CET', displayName: 'Central European Time' },
  { value: 'America/New_York', label: 'EST', displayName: 'Eastern Standard Time' },
  { value: 'America/Los_Angeles', label: 'PST', displayName: 'Pacific Standard Time' },
  { value: 'Australia/Sydney', label: 'AEST', displayName: 'Australian Eastern Time' },
  { value: 'Pacific/Auckland', label: 'NZST', displayName: 'New Zealand Time' }
];

interface TimezoneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TimezoneModal: React.FC<TimezoneModalProps> = ({ isOpen, onClose }) => {
  const { timezone, timezoneLabel, setTimezone } = useTimezone();
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [selectedLabel, setSelectedLabel] = useState(timezoneLabel);

  const handleSave = () => {
    setTimezone(selectedTimezone, selectedLabel);
    onClose();
  };

  const handleTimezoneSelect = (option: TimezoneOption) => {
    setSelectedTimezone(option.value);
    setSelectedLabel(option.label);
  };

  if (!isOpen) return null;

  return (
    <div className="timezone-modal-overlay" onClick={onClose}>
      <div className="timezone-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="timezone-modal-header">
          <h2>Select Timezone</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="timezone-modal-body">
          <div className="timezone-grid">
            {timezoneOptions.map((option) => (
              <div
                key={option.value}
                className={`timezone-option ${selectedTimezone === option.value ? 'selected' : ''}`}
                onClick={() => handleTimezoneSelect(option)}
              >
                <div className="timezone-label">{option.label}</div>
                <div className="timezone-name">{option.displayName}</div>
                <div className="timezone-value">{option.value}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="timezone-modal-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default TimezoneModal;
