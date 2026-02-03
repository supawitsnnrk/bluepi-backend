import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductEntity } from './entities/product.entity';
import { AdjustStockBodyDto } from './dto/adjust-stock.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    return await this.productService.create(createProductDto);
  }

  @Get()
  async getActiveProducts(): Promise<ProductEntity[]> {
    return await this.productService.getActiveProducts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.getProductAndStock(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  @Patch(':id/stock')
  async adjustStock(@Param('id') id: string, @Body() body: AdjustStockBodyDto) {
    return await this.productService.adjustProductStock({
      productId: id,
      deltaQty: body.deltaQty,
    });
  }
}
