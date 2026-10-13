import { Global, Module } from '@nestjs/common';
import { ValkeyService } from './valkey.service.js';

@Global()
@Module({
  providers: [ValkeyService],
  exports: [ValkeyService],
})
export class ValkeyModule {}
