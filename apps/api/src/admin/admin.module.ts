import { Module } from '@nestjs/common';
import { AdminController, SetupController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import { SetupService } from './setup.service.js';

@Module({
  controllers: [AdminController, SetupController],
  providers: [AdminService, SetupService, AdminGuard],
  exports: [AdminService, SetupService],
})
export class AdminModule {}
