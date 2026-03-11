import { IsString, IsNotEmpty, IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SendMessageDto {
  @ApiProperty({
    description: 'The content of the message',
    examples: {
      default: {
        summary: 'Default Example',
        value:
          "# Obesity or desire to lose weight\n\nThe treatment for obesity and weight loss is multidisciplinary and personalized, considering factors such as metabolism, lifestyle and the patient's health conditions.\n\n- Nutritional monitoring\n- Dietary reeducation\n- Use of weight control medications (under medical prescription)\n- Hormone treatments (when necessary)\n- Behavioral therapy\n- Supervised physical activity\n\n\n![demoByHassan](https://minio-qsw0os0kcss8sw4oo4ccsg4g.charsi.dev/hassan/sample-video.mp4)",
      },
      simpleMessage: {
        summary: 'Simple Text Message',
        value: 'Hello! This is a test message.',
      },
      markdownExample: {
        summary: 'Markdown Example',
        value: '**Bold Text**\n*Italic Text*\n\n- List Item 1\n- List Item 2',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  message: string

  @IsString()
  @ApiProperty({ default: 'api', description: 'Source of the message' })
  @IsNotEmpty()
  source: string
}
