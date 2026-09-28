import { PartialType } from '@nestjs/swagger';
import { CreateVenueDto } from './create-venue.dto.js';

// Every editable field, all optional. Status is not editable here: archiving
// has its own endpoint.
export class UpdateVenueDto extends PartialType(CreateVenueDto) {}
