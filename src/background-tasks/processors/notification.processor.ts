import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as Papa from 'papaparse'
import { PrismaService } from 'src/prisma/prisma.service'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import {
  BackgroundQueue,
  NotificationJob,
} from 'src/utils/constants/background.constants'
import { ContactService } from 'src/contact/contact.service'
import { Contact } from 'src/utils/constants/types'

interface IFireData {
  latitude: string
  longitude: string
  bright_ti4: string
  scan: string
  track: string
  acq_date: string
  acq_time: string
  satellite: string
  instrument: string
  confidence: string
  version: string
  bright_ti5: string
  frp: string
  daynight: string
}

@Processor(BackgroundQueue.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactService: ContactService,
  ) {
    super()
  }
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case NotificationJob.SEND_WILD_FIRE_NOTIFICATION: {
        this.logger.log(
          `Processing job ${job.id}: will send notifications to client `,
        )
        return await this.sendWildFireNotification(30)
      }
      default:
        return
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371
    const dLat = this.toRad(lat2 - lat1)
    const dLon = this.toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  private getDirection(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
  ): string {
    const dLon = this.toRad(toLon - fromLon)
    const lat1 = this.toRad(fromLat)
    const lat2 = this.toRad(toLat)
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    const bearing = Math.atan2(y, x)
    const compassBearing = ((bearing * 180) / Math.PI + 360) % 360

    const directions = [
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
    ]
    const index = Math.round(compassBearing / 45) % 8
    return directions[index]
  }

  private clusterWildfires(
    fires: IFireData[],
    radiusKm = 5,
  ): { centerLat: number; centerLon: number; points: IFireData[] }[] {
    const clusters: {
      centerLat: number
      centerLon: number
      points: IFireData[]
    }[] = []

    for (const fire of fires) {
      const fireLat = parseFloat(fire.latitude)
      const fireLon = parseFloat(fire.longitude)

      let foundCluster = false
      for (const cluster of clusters) {
        const distance = this.calculateDistance(
          fireLat,
          fireLon,
          cluster.centerLat,
          cluster.centerLon,
        )
        if (distance <= radiusKm) {
          cluster.points.push(fire)
          // Recalculate center
          const totalPoints = cluster.points.length
          cluster.centerLat =
            (cluster.centerLat * (totalPoints - 1) + fireLat) / totalPoints
          cluster.centerLon =
            (cluster.centerLon * (totalPoints - 1) + fireLon) / totalPoints
          foundCluster = true
          break
        }
      }

      if (!foundCluster) {
        clusters.push({
          centerLat: fireLat,
          centerLon: fireLon,
          points: [fire],
        })
      }
    }

    return clusters
  }

  isLikelyWildfire(fire: IFireData): boolean {
    return (
      parseFloat(fire.bright_ti4) > 300 &&
      parseFloat(fire.frp) > 5 &&
      (fire.confidence === 'h' || fire.confidence === 'n')
    )
  }

  async sendWildFireNotification(radiusKm = 30): Promise<void> {
    const res: any = []
    const url =
      'https://firms.mv/api/area/csv/G5RjxB0Z2rSTOB4ZPbH0OMEdw3XNQBbVAUAfj8rh/VIIRS_SNPP_NRT/world/1'

    try {
      this.logger.log('Fetching CSV data...')
      const response = await axios.get(url, {
        responseType: 'text',
        timeout: 180000,
      })

      const parsed = Papa.parse(response.data, {
        header: true,
        skipEmptyLines: true,
      })

      if (process.env.NODE_ENV === 'local') {
        const geoJson = {
          type: 'FeatureCollection',
          features: parsed.data.map((fire: IFireData) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [
                parseFloat(fire.longitude),
                parseFloat(fire.latitude),
              ],
            },
            properties: {
              ...fire,
              bright_ti4: parseFloat(fire.bright_ti4),
              bright_ti5: parseFloat(fire.bright_ti5),
              frp: parseFloat(fire.frp),
            },
          })),
        }

        // Save to file
        const fs = require('fs')
        const path = require('path')
        const outputPath = path.join(process.cwd(), 'fires2.geojson')
        fs.writeFileSync(outputPath, JSON.stringify(geoJson, null, 2))
        this.logger.log(`Saved GeoJSON to ${outputPath}`)
      }

      this.logger.log(`Total WildFire points ${parsed.data.length} `)
      const wildfireFirms: IFireData[] = parsed.data.filter(
        this.isLikelyWildfire,
      )

      this.logger.log(`Likely wildfire points 🔥: ${wildfireFirms.length}`)

      const contacts = await this.prisma.contacts.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        include: {
          companies: {
            include: {
              whatsapp_connector_server: true,
            },
          },
        },
      })

      for (const contact of contacts) {
        const nearbyFires: { distance: number; direction: string }[] = []

        // Skip contacts with null coordinates
        if (contact.latitude === null || contact.longitude === null) {
          continue
        }

        for (const cluster of wildfireFirms) {
          const distance = this.calculateDistance(
            contact.latitude,
            contact.longitude,
            parseFloat(cluster.latitude),
            parseFloat(cluster.longitude),
          )
          if (distance <= radiusKm) {
            const direction = this.getDirection(
              contact.latitude,
              contact.longitude,
              parseFloat(cluster.latitude),
              parseFloat(cluster.longitude),
            )
            nearbyFires.push({ distance, direction })
          }
        }

        if (nearbyFires.length > 0) {
          const fireList = nearbyFires
            .sort((a, b) => a.distance - b.distance)
            .map(f => `- ${f.distance.toFixed(2)} km ${f.direction}`)
            .join('\n')

          const message = `🔥 Attention: There are ${nearbyFires.length} wildfires in your region:\n${fireList}`
          this.logger.log(`Notification for contact ${contact.id}:\n${message}`)
          this.contactService.sendMessage(contact as Contact, message)
          res.push({
            contact: {
              id: contact.id,
              name: contact.name,
              lat: contact.latitude,
              lon: contact.longitude,
            },
            message,
          })
          // await this.notificationService.send(contact, message);
        }
      }

      this.logger.log('Wildfire notifications processed.')
      return res
    } catch (error) {
      this.logger.error(
        'Error fetching or processing fire data:',
        error.message,
      )
    }
  }
}
