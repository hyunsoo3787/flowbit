import { Global, Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';

@Global()
@Module({
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
