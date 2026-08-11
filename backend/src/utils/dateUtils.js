/**
 * Centralized Date Utilities
 * 
 * Handles business day logic where the day runs from 6:00 AM to 5:59 AM the next calendar day.
 */

class DateUtils {
  /**
   * Calculates the business date for a given Date object.
   * If the time is before 6:00 AM, the business date is the previous calendar day.
   * 
   * @param {Date|string|number} [dateInput] - The date to calculate for. Defaults to now.
   * @param {number} [startHour=6] - The hour the business day starts (0-23).
   * @returns {string} The business date in YYYY-MM-DD format.
   */
  getBusinessDate(dateInput = new Date(), startHour = 6) {
    const d = new Date(dateInput);
    
    // If the current hour is less than the start hour, it belongs to the previous business day
    if (d.getHours() < startHour) {
      d.setDate(d.getDate() - 1);
    }
    
    // Format to YYYY-MM-DD in local time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns the business date for yesterday.
   */
  getYesterdayBusinessDate() {
    const d = new Date();
    // Offset by 24 hours
    d.setDate(d.getDate() - 1);
    return this.getBusinessDate(d);
  }

  /**
   * Returns the first business day of the current month (e.g., YYYY-MM-01).
   */
  getBusinessMonthStart() {
    const d = new Date();
    if (d.getHours() < 6) {
      d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }
}

export const dateUtils = new DateUtils();
