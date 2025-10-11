import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomItemDto } from './create-custom-item.dto';

export class UpdateCustomItemDto extends PartialType(CreateCustomItemDto) {}
