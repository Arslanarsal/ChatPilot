import { ApiProperty } from '@nestjs/swagger'

export class LocationDto {
  @ApiProperty({
    type: 'number',
    description: 'Latitude coordinate',
    required: false,
    example: -23.5505,
  })
  latitude: number

  @ApiProperty({
    type: 'number', 
    description: 'Longitude coordinate',
    required: false,
    example: -46.6333,
  })
  longitude: number
}

export class WhatsBaileyDto {
  @ApiProperty({
    type: 'boolean',
    description: 'Whether message is from the clinic',
    example: true,
  })
  fromMe: boolean

  @ApiProperty({
    type: 'string',
    description: 'Message ID',
    example: '3ACEE84B5A421C73327B',
  })
  id: string

  @ApiProperty({
    type: 'string',
    description: 'User phone number',
    example: '923557609998',
  })
  userPhone: string

  @ApiProperty({
    type: 'string',
    description: 'Clinic phone number',
    example: '923147581976',
  })
  clinicPhone: string

  @ApiProperty({
    type: 'boolean',
    description: 'Whether to notify webhook',
    example: true,
  })
  shouldNotifyWebhook: boolean

  @ApiProperty({
    type: 'boolean',
    description: 'Whether message is audio',
    example: false,
  })
  isAudio: boolean

  @ApiProperty({
    type: 'boolean',
    description: 'Whether message has media',
    example: false,
  })
  hasMedia: boolean

  @ApiProperty({
    type: 'boolean',
    description: 'Whether message has document',
    example: false,
  })
  hasDocument: boolean

  @ApiProperty({
    type: 'string',
    description: 'Message text content',
    required: false,
    example: 'Hello there',
  })
  text?: string

  @ApiProperty({
    type: 'string',
    description: 'Additional message info',
    required: false,
    example: 'Additional message info',
  })
  info?: string

  @ApiProperty({
    type: 'object',
    description: 'Media information',
    required: false,
    example: {},
  })
  mediaBuffer?: any

  @ApiProperty({
    type: 'object',
    description: 'Additional metadata',
    required: false,
    example: {},
  })
  meta?: any;

  @ApiProperty({
    type: 'boolean',
    description: 'whether message has location',
    example: true,
  })
  hasLocation: boolean
  @ApiProperty({
    type: 'object',
    description: 'Location information',
    required: false,
    example: {
      latitude: -23.5505,
      longitude: -46.6333,
    },
  })
  location?: LocationDto


}