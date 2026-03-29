import { Injectable, Logger } from '@nestjs/common'
import { StorageClient } from '@supabase/storage-js'

@Injectable()
export class SupabaseStorageService {
  private storageClient: StorageClient
  private readonly logger = new Logger(SupabaseStorageService.name)

  private static readonly MIME_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/aac': 'aac',
    'audio/m4a': 'm4a',
    'audio/amr': 'amr',
    'audio/mpeg': 'mp3',
    'audio/ogg; codecs=opus': 'ogg',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'text/plain': 'txt',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  }

  constructor() {
    const storageUrl = process.env.SUPABASE_STORAGE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_KEY

    if (!storageUrl || !serviceKey) {
      this.logger.warn('Missing Supabase storage configuration')
      return
    }

    const normalizedUrl = storageUrl.replace(/\/+$/, '').endsWith('/storage/v1')
      ? storageUrl.replace(/\/+$/, '')
      : `${storageUrl.replace(/\/+$/, '')}/storage/v1`

    this.storageClient = new StorageClient(normalizedUrl, {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    })
  }

  async uploadCompanyAsset(
    companyId: number,
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string | null> {
    try {
      const timestamp = Date.now()
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const path = `${companyId}/${timestamp}-${sanitizedName}`
      const bucketName = 'company-assets'

      const { data, error } = await this.storageClient
        .from(bucketName)
        .upload(path, fileBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType,
        })

      if (error) {
        this.logger.error(`Failed to upload to Supabase: [${SupabaseStorageService.name}]`, JSON.stringify({ error, path }))
        return null
      }

      const {
        data: { publicUrl },
      } = this.storageClient.from(bucketName).getPublicUrl(path)

      this.logger.log(`Asset uploaded: ${publicUrl}`)
      return publicUrl
    } catch (error) {
      this.logger.error('Upload failed', { error: error.message })
      return null
    }
  }

  async deleteCompanyAsset(fileUrl: string): Promise<boolean> {
    try {
      const bucketName = 'company-assets'
      // Extract path from URL
      const urlParts = fileUrl.split(`/${bucketName}/`)
      if (urlParts.length < 2) return false

      const filePath = decodeURIComponent(urlParts[1])
      const { error } = await this.storageClient
        .from(bucketName)
        .remove([filePath])

      if (error) {
        this.logger.error('Failed to delete from Supabase', { error })
        return false
      }

      return true
    } catch (error) {
      this.logger.error('Delete failed', { error: error.message })
      return false
    }
  }

  /**
   * Generic upload to any bucket - used for chat media (images, videos, docs, audio)
   */
  async upload(
    fileName: string,
    fileBuffer: Buffer,
    bucketName: string,
    contentType: string,
  ): Promise<string | null> {
    try {
      const timestamp = Date.now()
      const lastSlash = fileName.lastIndexOf('/')
      const uniqueFileName =
        lastSlash >= 0
          ? `${fileName.substring(0, lastSlash + 1)}${timestamp}-${fileName.substring(lastSlash + 1)}`
          : `${timestamp}-${fileName}`

      const { data, error } = await this.storageClient
        .from(bucketName)
        .upload(uniqueFileName, fileBuffer, {
          upsert: true,
          contentType,
        })

      if (error) {
        this.logger.error('Failed to upload file to Supabase', { error, bucketName, fileName })
        return null
      }

      const {
        data: { publicUrl },
      } = this.storageClient.from(bucketName).getPublicUrl(uniqueFileName)

      return publicUrl
    } catch (error) {
      this.logger.error('Upload failed', { error: error.message, bucketName, fileName })
      return null
    }
  }

  getMediaExtension(mimeType: string): string {
    return SupabaseStorageService.MIME_EXTENSIONS[mimeType] || ''
  }

  /**
   * Upload chat media (images, videos, documents, audio) from WhatsApp messages.
   * Called by the webhook when WB sends media buffers.
   */
  async uploadMedia(
    mediaBuffer: Buffer,
    mimeType: string,
    companyPhone: string,
    contactPhone: string,
  ): Promise<string | null> {
    try {
      const ext = this.getMediaExtension(mimeType)
      if (!ext) {
        this.logger.warn('Unknown mime type for media upload', { mimeType })
        return null
      }

      const bucketName = 'ChatPilot-media'
      const filePath = `${companyPhone}/${contactPhone}/media.${ext}`

      return await this.upload(filePath, mediaBuffer, bucketName, mimeType)
    } catch (error) {
      this.logger.error('uploadMedia failed', { error: error.message, companyPhone, contactPhone })
      return null
    }
  }
}
