import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TimezoneContextType {
  timezone: string;
  timezoneLabel: string;
  setTimezone: (timezone: string, label: string) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};

interface TimezoneProviderProps {
  children: ReactNode;
}

export const TimezoneProvider: React.FC<TimezoneProviderProps> = ({ children }) => {
  const [timezone, setTimezoneState] = useState<string>('Asia/Manila');
  const [timezoneLabel, setTimezoneLabel] = useState<string>('PHT');

  const setTimezone = (newTimezone: string, newLabel: string) => {
    setTimezoneState(newTimezone);
    setTimezoneLabel(newLabel);
    // Store in localStorage for persistence
    localStorage.setItem('userTimezone', newTimezone);
    localStorage.setItem('userTimezoneLabel', newLabel);
  };

  // Load timezone from localStorage on mount
  React.useEffect(() => {
    const storedTimezone = localStorage.getItem('userTimezone');
    const storedLabel = localStorage.getItem('userTimezoneLabel');
    if (storedTimezone && storedLabel) {
      setTimezoneState(storedTimezone);
      setTimezoneLabel(storedLabel);
    }
  }, []);

  const value = {
    timezone,
    timezoneLabel,
    setTimezone,
  };

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
};
