// src/lib/dates.helper.ts
import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class DatesHelper {
  private readonly TIMEZONE = 'America/Sao_Paulo';
  private readonly logger = new Logger(DatesHelper.name);
  private readonly PORTUGUESE_DAYS = {
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
    '0': 'Sunday',
  };

  localNow(): Date {
    const nowUTC = DateTime.utc();
    const converted = nowUTC.setZone(this.TIMEZONE);
    return converted;
  }

  localWeekdayName(timestamp: Date = new Date(this.localNow())): string {
    return this.PORTUGUESE_DAYS[timestamp.getDay()];
  }

  getDateAliases(startDate: Date = new Date(this.localNow()), days: number = 14): string[] {
    return Array.from({ length: days }, (_, i) => {
      const currentDate = DateTime.fromJSDate(startDate).plus({ days: i });
      return `${currentDate.toFormat('yyyy-MM-dd')} ${this.getDateAlias(currentDate.toJSDate())}`;
    });
  }

  private getDateAlias(targetDate: Date, referenceDate: Date = new Date(this.localNow())): string {
    referenceDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      DateTime.fromJSDate(targetDate).diff(DateTime.fromJSDate(referenceDate), 'days').days,
    );

    if (diffDays === 0) return 'is today, ' + this.localWeekdayName(targetDate);
    if (diffDays === 1) return 'is tomorrow, ' + this.localWeekdayName(targetDate);
    if (diffDays === -1) return 'was yesterday, ' + this.localWeekdayName(targetDate);

    if (diffDays < -1 || diffDays >= 14) {
      return diffDays > 0 ? `in ${diffDays} days` : `${-diffDays} days ago`;
    }

    if (diffDays < 7) return 'is ' + this.localWeekdayName(targetDate);
    if (diffDays < 14) return 'is next ' + this.localWeekdayName(targetDate);

    throw new Error('Date is not valid');
  }

  convertFromZulu(date: Date | string, timezone: string = this.TIMEZONE): Date {
    const parsedDate = DateTime.fromISO(typeof date === 'string' ? date : date.toISOString(), {
      zone: 'utc',
    });

    const convertedDate = parsedDate.setZone(timezone);

    return convertedDate.setLocale('pt-BR').toFormat("d 'de' MMMM 'às' HH:mm");
  }

  convertToZulu(date: Date | string, timezone: string = this.TIMEZONE): Date {
    const dt = DateTime.fromISO(typeof date === 'string' ? date : date.toISOString(), {
      zone: timezone,
    });

    return dt.toUTC().toJSDate();
  }
  addHours(date: string | Date, hours: number): string {
    return new Date(new Date(date).getTime() + hours * 60 * 60 * 1000).toISOString();
  }
  minusHours(date: string | Date, hours: number): string {
    return new Date(new Date(date).getTime() - hours * 60 * 60 * 1000).toISOString();
  }
  toHumanDate(dateInput: string | Date): string {
    let dt: DateTime;

    if (typeof dateInput === 'string') {
      dt = DateTime.fromISO(dateInput, { zone: 'utc' });
    } else if (dateInput instanceof Date) {
      dt = DateTime.fromJSDate(dateInput);
    } else {
      const errorMsg = 'Input must be a Date object or an ISO 8601 string';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    return dt.setLocale('pt-BR').toFormat("d 'de' MMMM 'às' HH:mm");
  }

  toHumanDateTime(dateInput: string | Date, timezone: string): string {
    const localTime = DateTime.fromISO(dateInput, { zone: 'utc' }).setZone(timezone);
    return localTime.toFormat("d 'de' LLLL 'às' HH:mm");
  }

  toLocalDateTime(date: string, companyTimeZone: string): string {
    const localDate = DateTime.fromISO(date, { zone: companyTimeZone });

    if (!localDate.isValid) {
      throw new Error(`Invalid date or timezone: ${date}, ${companyTimeZone}`);
    }

    return localDate.toISO(); // Includes offset
  }

  interpretAsLocalTime(date: string | Date, targetTimeZone: string): string {
    const dt =
      typeof date === 'string'
        ? DateTime.fromISO(date, { zone: 'utc' })
        : DateTime.fromJSDate(date, { zone: 'utc' });

    const { year, month, day, hour, minute, second } = dt;

    const local = DateTime.fromObject(
      { year, month, day, hour, minute, second },
      { zone: targetTimeZone },
    );

    return local.toISO();
  }
}
