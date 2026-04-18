
/**
 * 
 * @param timezone 
 * @returns 
 */
export const getCurrentDate = (timezone: string = 'Asia/Manila'): string => {
  return new Date().toLocaleDateString('en-PH', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
};

/**
 * 
 * @param timezone 
 * @returns 
 */
export const getCurrentDateTime = (timezone: string = 'Asia/Manila'): string => {
  return new Date().toLocaleString('en-PH', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

/**
 * 
 * @param dateString 
 * @param includeTime 
 * @param timezone 
 * @returns 
 */
export const formatDate = (dateString: string, includeTime: boolean = false, timezone: string = 'Asia/Manila'): string => {
  if (!dateString) return 'N/A';
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = true;
  }
  
  return new Date(dateString).toLocaleString('en-PH', options);
};

// Legacy functions for backward compatibility
export const getCurrentDatePH = (): string => getCurrentDate('Asia/Manila');
export const getCurrentDateTimePH = (): string => getCurrentDateTime('Asia/Manila');
export const formatDatePH = (dateString: string, includeTime: boolean = false): string => formatDate(dateString, includeTime, 'Asia/Manila');

/**
 * 
 * 
 */
export const parseBackendDate = (dateString?: string | null): Date | null => {
  if (!dateString) return null;

  const normalized = dateString.trim();
  if (!normalized) return null;

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;
  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

/**
 * 
 * @returns 
 */
export const getCurrentTimestampPH = (): string => {
  const now = new Date();
  const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return phTime.toISOString();
};
