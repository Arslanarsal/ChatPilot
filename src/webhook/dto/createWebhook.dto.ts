import { ApiProperty } from '@nestjs/swagger';

export class WhatsBaileyDto {
  @ApiProperty({
    type: 'boolean',
    description: 'Whether message is from the clinic',
    example: true,
  })
  fromMe: boolean;

  @ApiProperty({
    type: 'string',
    description: 'Message ID',
    example: '3ACEE84B5A421C73327B',
  })
  id: string;

  @ApiProperty({
    type: 'string',
    description: 'User phone number',
    example: '923557609998',
  })
  userPhone: string;

  @ApiProperty({
    type: 'string',
    description: 'Clinic phone number',
    example: '923147581976',
  })
  clinicPhone: string;

  @ApiProperty({
    type: 'boolean',
    description: 'Whether to notify webhook',
    example: true,
  })
  shouldNotifyWebhook: boolean;

  @ApiProperty({
    type: 'boolean',
    description: 'Whether message is audio',
    example: false,
  })
  isAudio: boolean;

  @ApiProperty({
    type: 'boolean',
    description: 'Whether message has media',
    example: false,
  })
  hasMedia: boolean;

  @ApiProperty({
    type: 'boolean',
    description: 'Whether message has document',
    example: false,
  })
  hasDocument: boolean;

  @ApiProperty({
    type: 'string',
    description: 'Message text content',
    required: false,
    example: 'Hello there',
  })
  text?: string;

  @ApiProperty({
    type: 'string',
    description: 'Additional message info',
    required: false,
    example: 'Additional message info',
  })
  info?: string;

  @ApiProperty({
    type: 'string',
    description: 'Media buffer as base64 string',
    required: false,
    example: {},
  })
  mediaBuffer?: string;

  @ApiProperty({
    type: 'string',
    description: 'Additional metadata',
    required: false,
    example: {},
  })
  meta?: any;

  @ApiProperty({
    type: 'string',
    description: 'User Whatsapp name',
    required: false,
    example: 'Dan Joe',
  })
  senderName?: string;

  @ApiProperty({
    // type: 'string',
    description: 'Message external reference content',
    required: false,
    example: {
      title: 'Ali Amazonic tools',
      body: '#salesnavigator #linkedinpremium #linkedinsalesnavigator #leadgeneration #linkedinmarketing',
      mediaType: 'IMAGE',
      thumbnailUrl:
        'https://scontent.xx.fbcdn.net/v/t45.1600-4/476366347_120214341762940208_8686963301868389156_n.jpg?stp=c3.3.300.300a_dst-jpg_p306x306_tt6&_nc_cat=110&ccb=1-7&_nc_sid=e37a05&_nc_ohc=dEBxJMSTWMEQ7kNvwHvIBw1&_nc_oc=AdmI9xkG3AZ3l03lxgT3GCAVMlU6kcIPuU84yrZt6Tryc0P50nbuJtmGzby4Vs2h1a3Iim5O2TOAMw9DDWzYbYul&_nc_ad=z-m&_nc_cid=0&_nc_zt=1&_nc_ht=scontent.xx&_nc_gid=YHUKkYcFpidiabMk5P5ffg&oh=00_AfPfT-aXLm7xrOR0EjFHV2U0Ctx6ECsz2wTT7E4kZ14DMg&oe=6859C6E2',
      thumbnail:
        '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',
      sourceType: 'ad',
      sourceId: '120218492746390208',
      sourceUrl: 'https://www.instagram.com/p/DICRbqXAa1J/',
      containsAutoReply: false,
      renderLargerThumbnail: true,
      showAdAttribution: true,
      ctwaClid:
        'Afdw-MDGL0ijUulNBnK5ymZ4mwgT-VR9tNzVSHwIfHwJtApUcn-0Z5XWJ4bXOFzQ78vs0VVIqShKHUbN_YJuum5F_KlkWGtaXVCIu7kVyfgqgQqNQ1-vuF7BtbPiHoV8duCp1dPSoA',
    },
  })
  externalAdReply?: any;
}
