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
    '7': 'Sunday',
  };

  public localNow(timezone: string): DateTime {
    return DateTime.now().setZone(timezone);
  }

  public localWeekdayName(dateTime: DateTime): string {
    return this.PORTUGUESE_DAYS[dateTime.weekday];
  }

  public getDateAliases(timezone: string, days: number = 14): string[] {
    const startDate = this.localNow(timezone);
    return Array.from({ length: days }, (_, i) => {
      const currentDate = startDate.plus({ days: i });
      return `${currentDate.toFormat('yyyy-MM-dd')} ${this.getDateAlias(currentDate)}`;
    });
  }

  private getDateAlias(targetDate: DateTime): string {
    const referenceDate = this.localNow(targetDate.zone.name).startOf('day');
    const diffDays = Math.floor(targetDate.startOf('day').diff(referenceDate, 'days').days);

    if (diffDays === 0) return 'é hoje, ' + this.localWeekdayName(targetDate);
    if (diffDays === 1) return 'é amanhã, ' + this.localWeekdayName(targetDate);

    if (diffDays > 1 && diffDays < 7) {
      return 'é ' + this.localWeekdayName(targetDate);
    }
    if (diffDays >= 7 && diffDays < 14) {
      return 'é próxima/o ' + this.localWeekdayName(targetDate);
    }
    return 'é ' + this.localWeekdayName(targetDate);
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
