import { BotReplyType } from '@prisma/client';
import { DateTime } from 'luxon';
import { Clinic, Contact } from './constant/types';

interface TimeBlock {
  start_h: number;
  end_h: number;
}

interface DeactivationSchedule {
  monday?: TimeBlock;
  tuesday?: TimeBlock;
  wednesday?: TimeBlock;
  thursday?: TimeBlock;
  friday?: TimeBlock;
  saturday?: TimeBlock;
  sunday?: TimeBlock;
}

export function isWithinDeactivationSchedule(clinic: Clinic): boolean {
  const schedule: DeactivationSchedule | null =
    clinic.deactivation_schedule as DeactivationSchedule | null;

  if (!schedule) {
    return false;
  }

  const clinicTimezone = clinic.timezone || 'America/Sao_Paulo';
  const now = DateTime.now().setZone(clinicTimezone);
  const currentDay = now.weekday;
  const currentHour = now.hour;

  const dayMap = {
    7: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };

  const currentDayKey = dayMap[currentDay as keyof typeof dayMap];
  const daySchedule = schedule[currentDayKey as keyof DeactivationSchedule];

  if (!daySchedule) {
    return false;
  }

  return currentHour >= daySchedule.start_h && currentHour < daySchedule.end_h;
}

export function shouldBotDeactivated(botReplyTo: BotReplyType, isPaidTraffic = false): boolean {
  switch (botReplyTo) {
    case BotReplyType.all:
      return false;

    case BotReplyType.paid_traffic_only: // from add
      return !isPaidTraffic; // from add

    case BotReplyType.non_paid_traffic_only: // not from add
      return isPaidTraffic; // true  //false

    default:
      return false;
  }
}

export function shouldBotReply(clinic: Clinic, contact: Contact): boolean {
  if (
    !clinic.is_bot_activated ||
    !contact.is_bot_activated ||
    !contact.is_replies_activated ||
    !clinic.is_replies_activated
  ) {
    return false;
  }

  if (isWithinDeactivationSchedule(clinic)) {
    return false;
  }

  return true;
}
