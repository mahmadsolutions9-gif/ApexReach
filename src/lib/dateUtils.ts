import { format, formatDistanceToNow, isValid } from 'date-fns';

/**
 * Safely parses a date value into a Date object.
 * Handles SQLite CURRENT_TIMESTAMP format (YYYY-MM-DD HH:MM:SS) 
 * by converting it to ISO 8601 if needed.
 */
export const parseSafeDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  let date = new Date(dateValue);
  
  // If invalid, try replacing space with T for SQLite timestamps
  if (!isValid(date) && typeof dateValue === 'string') {
    date = new Date(dateValue.replace(' ', 'T'));
  }
  
  return isValid(date) ? date : null;
};

/**
 * Safely formats a date using toLocaleTimeString.
 */
export const safeLocaleTimeString = (dateValue: any, locales?: string | string[], options?: Intl.DateTimeFormatOptions): string => {
  const date = parseSafeDate(dateValue);
  if (!date) return 'N/A';
  try {
    return date.toLocaleTimeString(locales, options);
  } catch (e) {
    return 'N/A';
  }
};

/**
 * Safely formats a date using toLocaleDateString.
 */
export const safeLocaleDateString = (dateValue: any, locales?: string | string[], options?: Intl.DateTimeFormatOptions): string => {
  const date = parseSafeDate(dateValue);
  if (!date) return 'N/A';
  try {
    return date.toLocaleDateString(locales, options);
  } catch (e) {
    return 'N/A';
  }
};

/**
 * Safely formats a date using date-fns format.
 */
export const safeFormat = (dateValue: any, formatStr: string): string => {
  const date = parseSafeDate(dateValue);
  if (!date) return 'N/A';
  return format(date, formatStr);
};

/**
 * Safely formats a date using date-fns formatDistanceToNow.
 */
export const safeFormatDistanceToNow = (dateValue: any, options?: any): string => {
  const date = parseSafeDate(dateValue);
  if (!date) return 'just now';
  return formatDistanceToNow(date, options);
};
