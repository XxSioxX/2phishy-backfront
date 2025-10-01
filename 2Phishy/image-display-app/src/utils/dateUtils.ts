/**
 * Utility functions for consistent timezone handling
 */

/**
 * Get current date in specified timezone
 * @param timezone - The timezone to use (default: Asia/Manila)
 * @returns Current date in YYYY-MM-DD format
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
 * Get current date and time in specified timezone
 * @param timezone - The timezone to use (default: Asia/Manila)
 * @returns Current date and time in specified timezone
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
 * Format a date string to specified timezone
 * @param dateString - The date string to format
 * @param includeTime - Whether to include time in the output
 * @param timezone - The timezone to use (default: Asia/Manila)
 * @returns Formatted date string in specified timezone
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
 * Get current timestamp in Philippine Time
 * @returns Current timestamp as ISO string adjusted for Philippine Time
 */
export const getCurrentTimestampPH = (): string => {
  const now = new Date();
  const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return phTime.toISOString();
};
