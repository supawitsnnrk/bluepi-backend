export class PurchaseResponseDto {
  success: boolean;
  orderId: string;
  changeAmount: number;
  change: ChangeDetailDto[];
}

export class ChangeDetailDto {
  amount: number;
  quantity: number;
}
