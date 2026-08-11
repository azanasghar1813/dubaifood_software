/**
 * Frontend Date Utilities
 * 
 * Matches the backend business logic where the business day runs from 
 * 6:00 AM to 5:59 AM the next calendar day.
 */

export class DateUtils {
  static getBusinessDate(dateInput: Date | string | number = new Date(), startHour: number = 6): string {
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

  static getYesterdayBusinessDate(): string {
    const d = new Date();
    // Offset by 24 hours
    d.setDate(d.getDate() - 1);
    return this.getBusinessDate(d);
  }

  static getBusinessMonthStart(): string {
    const d = new Date();
    if (d.getHours() < 6) {
      d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }
}
