import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  send(senderId: string, dto: SendMessageDto) {
    return this.prisma.message.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        subject: dto.subject,
        body: dto.body,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  inbox(userId: string) {
    return this.prisma.message.findMany({
      where: { receiverId: userId },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  sent(userId: string) {
    return this.prisma.message.findMany({
      where: { senderId: userId },
      include: {
        receiver: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message || message.receiverId !== userId) {
      throw new NotFoundException('Message not found');
    }
    return this.prisma.message.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
