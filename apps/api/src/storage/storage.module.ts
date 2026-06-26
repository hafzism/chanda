import { Global, Module } from '@nestjs/common';

import { ObjectStorageService } from './storage.service';
import { OBJECT_STORAGE } from './storage.types';

@Global()
@Module({
  exports: [OBJECT_STORAGE],
  providers: [
    ObjectStorageService,
    { provide: OBJECT_STORAGE, useExisting: ObjectStorageService },
  ],
})
export class StorageModule {}
