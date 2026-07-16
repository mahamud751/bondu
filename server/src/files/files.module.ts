import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MalwareScannerService } from './malware-scanner.service';
@Module({ controllers: [FilesController], providers: [FilesService,MalwareScannerService], exports: [FilesService,MalwareScannerService] })
export class FilesModule {}
