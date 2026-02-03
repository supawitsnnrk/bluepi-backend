import { IsNotEmpty, IsUUID } from 'class-validator';

export class SelectProductDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @IsUUID()
  @IsNotEmpty()
  productId: string;
}

export class SelectProductBodyDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;
}

export class SelectProductResponseDto {
  success: boolean;
  orderId: string;
  productId: string;
}
