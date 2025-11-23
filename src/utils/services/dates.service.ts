// src/lib/dates.helper.ts
import { Injectable, Logger } from '@nestjs/common'
import { DateTime } from "luxon";

@Injectable()
export class DatesHelper {
  private readonly TIMEZONE = 'America/Sao_Paulo'
  private readonly logger = new Logger(DatesHelper.name)
  private readonly PORTUGUESE_DAYS = {
    '1' : 'segunda-feira',
    '2' : 'terça-feira',
    '3' : 'quarta-feira',
    '4' : 'quinta-feira',
    '5' : 'sexta-feira',
    '6' : 'sábado',
    '0' :'domingo',
  }
  localNow(): Date {
    const nowUTC = DateTime.utc();
const converted = nowUTC.setZone(this.TIMEZONE)
    return converted
  }

  localWeekdayName(timestamp: Date = new Date(this.localNow())): string {
    return this.PORTUGUESE_DAYS[timestamp.getDay()]
  }

  getDateAliases(
    startDate: Date = new Date(this.localNow()),
    days: number = 14
  ): string[] {
    return Array.from({ length: days }, (_, i) => {
      const currentDate = DateTime.fromJSDate(startDate).plus({ days: i });
      return `${currentDate.toFormat('yyyy-MM-dd')} ${this.getDateAlias(currentDate.toJSDate())}`;
    });
  }

  private getDateAlias(
    targetDate: Date,
    referenceDate: Date = new Date(this.localNow()),
  ): string {
    referenceDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(DateTime.fromJSDate(targetDate).diff(DateTime.fromJSDate(referenceDate), 'days').days)

    if (diffDays === 0) return 'é hoje, ' + this.localWeekdayName(targetDate)
    if (diffDays === 1) return 'é amanhã, ' + this.localWeekdayName(targetDate)
    if (diffDays === -1)
      return 'foi ontem, ' + this.localWeekdayName(targetDate)

    if (diffDays < -1 || diffDays >= 14) {
      return diffDays > 0 ? `em ${diffDays} dias` : `há ${-diffDays} dias`
    }

    if (diffDays < 7) return 'é ' + this.localWeekdayName(targetDate)
    if (diffDays < 14) return 'é próxima/o ' + this.localWeekdayName(targetDate)

    throw new Error('Data não é válida')
  }

 

  convertFromZulu(date: Date | string, timezone: string = this.TIMEZONE): Date {
    const parsedDate = DateTime.fromISO(
      typeof date === 'string' ? date : date.toISOString(),
      { zone: 'utc' } 
    );
  
    const convertedDate = parsedDate.setZone(timezone);

    return convertedDate.setLocale('pt-BR').toFormat("d 'de' MMMM 'às' HH:mm");
  }

  convertToZulu(date: Date | string, timezone: string = this.TIMEZONE): Date {
    const dt = DateTime.fromISO(typeof date === "string" ? date : date.toISOString(), { zone: timezone });

    return dt.toUTC().toJSDate();
  }
  addHours(date: string | Date, hours: number): string {
    return new Date(
      new Date(date).getTime() + hours * 60 * 60 * 1000,
    ).toISOString()
  }
   minusHours(date: string | Date, hours: number): string {
     return new Date(
       new Date(date).getTime() - hours * 60 * 60 * 1000,
     ).toISOString()
   }
   toHumanDate(dateInput: string | Date): string {
    let dt: DateTime;

    if (typeof dateInput === "string") {
        dt = DateTime.fromISO(dateInput, { zone: "utc" });
    } else if (dateInput instanceof Date) {
        dt = DateTime.fromJSDate(dateInput);
    } else {
      const errorMsg ="Input must be a Date object or an ISO 8601 string"
      this.logger.error(errorMsg);
        throw new Error(errorMsg);
    }

    return dt.setLocale("pt-BR").toFormat("d 'de' MMMM 'às' HH:mm");
}

}
