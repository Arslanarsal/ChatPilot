export enum BackgroundQueue {
  REMINDERS = 'reminders',
  REPLIES = 'replies',
  FOLLOW_UPS = 'followUp',

  // WhatsApp Connection Status Queue
  WA_CONN_QUEUE = 'WA-Conn-Queue',
}

export enum FollowUpJob {
  SEND_FOLLOW_UPS = 'sendFollowUps',
  BOOKING_REMINDER_1 = 'bookingReminder1',
  BOOKING_REMINDER_2 = 'bookingReminder2',
  SCHEDULE_SMART_FOLLOW_UPS = 'scheduleSmartFollowUps',
  SEND_SMART_FOLLOW_UPS = 'sendSmartFollowUps',
}
