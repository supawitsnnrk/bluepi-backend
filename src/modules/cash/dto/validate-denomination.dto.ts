import { IsInt, IsNotEmpty, IsPositive, IsUUID } from 'class-validator';

export class ValidateDenominationDto {
  @IsUUID()
  @IsNotEmpty()
  denominationId: string;

  @IsInt()
  @IsPositive()
  qty: number;
}
