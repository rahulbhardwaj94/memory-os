import { Module } from '@nestjs/common';
import { WorkingMemoryService } from './working-memory.service';

@Module({
  providers: [WorkingMemoryService],
  exports: [WorkingMemoryService],
})
export class WorkingMemoryModule {}
