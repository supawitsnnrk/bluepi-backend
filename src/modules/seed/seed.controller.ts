import { Controller, Post } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  /**
   * POST /api/seed/demo-products
   *
   * สร้างข้อมูลสินค้าตัวอย่างสำหรับ demo/testing
   * - Products (สินค้าตัวอย่าง 7 รายการ)
   * - Product Stock (จำนวนสินค้าในเครื่อง ตั้งต้นอย่างละ 20 ชิ้น)
   *
   * หมายเหตุ: Denominations และ Cash Stock สร้างโดย migration แล้ว
   *
   * ใช้สำหรับ: ตั้งค่าข้อมูลสินค้า demo หรือ re-seed ข้อมูลสินค้าใหม่
   *
   * Return: summary ของข้อมูลสินค้าที่สร้าง (จำนวน records แต่ละประเภท)
   */
  @Post('demo-products')
  async seedDemoProducts() {
    return await this.seedService.seedDemoProducts();
  }
}
