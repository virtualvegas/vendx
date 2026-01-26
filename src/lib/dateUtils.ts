/**
 * Date utilities to fix timezone issues.
 * 
 * The issue: When parsing "YYYY-MM-DD" strings, JavaScript's Date constructor
 * and parseISO treat them as UTC midnight, causing dates to shift back one day
 * in western timezones.
 * 
 * Solution: Parse date strings as local time, not UTC.
 */

/**
 * Parse a date string (YYYY-MM-DD) as local time, not UTC.
 * This prevents the "one day behind" issue.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // If it's a full ISO timestamp with time, parse normally
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  
  // For date-only strings (YYYY-MM-DD), parse as local time
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date to YYYY-MM-DD string using local time components.
 * This prevents UTC conversion issues.
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string or Date object for display (e.g., "Jan 15, 2024")
 * Handles both date-only strings and full timestamps correctly.
 */
export function formatDisplayDate(dateInput: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof dateInput === 'string' ? parseLocalDate(dateInput) : dateInput;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  return date.toLocaleDateString(undefined, options || defaultOptions);
}

/**
 * Check if a date string represents today (local time).
 */
export function isLocalToday(dateStr: string): boolean {
  const date = parseLocalDate(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if date1 is after date2 (local time comparison).
 */
export function isLocalAfter(dateStr1: string, dateStr2: string): boolean {
  return parseLocalDate(dateStr1) > parseLocalDate(dateStr2);
}

/**
 * Check if date1 is before date2 (local time comparison).
 */
export function isLocalBefore(dateStr1: string, dateStr2: string): boolean {
  return parseLocalDate(dateStr1) < parseLocalDate(dateStr2);
}
