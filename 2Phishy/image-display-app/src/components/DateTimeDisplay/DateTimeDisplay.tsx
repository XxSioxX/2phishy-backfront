import React, { useState, useEffect } from 'react';
import { getCurrentDateTime } from '../../utils/dateUtils';
import { useTimezone } from '../../contexts/TimezoneContext';
import './DateTimeDisplay.scss';

const DateTimeDisplay: React.FC = () => {
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { timezone, timezoneLabel } = useTimezone();

  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(getCurrentDateTime(timezone));
    };

    // Update immediately
    updateDateTime();

    // Update every second
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, [timezone]);

  return (
    <div className="datetime-display">
      <div className="datetime-content">
        <span className="datetime-label">{timezoneLabel}</span>
        <span className="datetime-value">{currentDateTime}</span>
      </div>
    </div>
  );
};

export default DateTimeDisplay;
