import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { PostsModule } from './posts/posts.module';
import { AttendanceModule } from './attendance/attendance.module';
import { GradesModule } from './grades/grades.module';
import { FeesModule } from './fees/fees.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { LeaveModule } from './leave/leave.module';
import { MessagesModule } from './messages/messages.module';
import { TimetableModule } from './timetable/timetable.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    PostsModule,
    AttendanceModule,
    GradesModule,
    FeesModule,
    AssignmentsModule,
    LeaveModule,
    MessagesModule,
    TimetableModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
