import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProductService } from './product.service';
import { ProductEntity } from './entities/product.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ProductService', () => {
  let service: ProductService;
  // let productRepository: Repository<ProductEntity>;
  let dataSource: DataSource;

  const mockProduct = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Product',
    price: 20,
    sku: 'TEST-001',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockProductStock = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    quantity: 10,
    product: mockProduct,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockProductRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: mockProductRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    // productRepository = module.get<Repository<ProductEntity>>(
    //   getRepositoryToken(ProductEntity),
    // );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product with initial stock', async () => {
      const createDto = {
        name: 'Test Product',
        price: 20,
        sku: 'TEST-001',
      };

      mockQueryRunner.manager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null), // No duplicate
      });
      mockQueryRunner.manager.create.mockReturnValue(mockProduct);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(mockProduct) // Save product
        .mockResolvedValueOnce(mockProductStock); // Save stock

      const result = await service.create(createDto);

      expect(result).toEqual(mockProduct);
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw ConflictException if SKU already exists', async () => {
      const createDto = {
        name: 'Test Product',
        price: 20,
        sku: 'TEST-001',
      };

      mockQueryRunner.manager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockProduct), // Duplicate found
      });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });
  });

  describe('getActiveProducts', () => {
    it('should return list of active products with stock', async () => {
      const mockProducts = [{ ...mockProduct, productStock: mockProductStock }];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProducts),
      };

      jest
        .spyOn(dataSource, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getActiveProducts();

      expect(result).toEqual(mockProducts);
      expect(dataSource.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('getProductAndStock', () => {
    it('should return product with stock relation', async () => {
      mockProductRepository.findOne.mockResolvedValue({
        ...mockProduct,
        productStock: mockProductStock,
      });

      const result = await service.getProductAndStock(mockProduct.id);

      expect(result.productStock).toBeDefined();
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockProduct.id },
        relations: { productStock: true },
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.getProductAndStock('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update product successfully', async () => {
      const updateDto = { name: 'Updated Product', price: 25 };
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockProductRepository.save.mockResolvedValue({
        ...mockProduct,
        ...updateDto,
      });

      const result = await service.update(mockProduct.id, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.price).toBe(updateDto.price);
    });
  });

  describe('adjustProductStock', () => {
    it('should increase stock quantity', async () => {
      const adjustDto = {
        productId: mockProduct.id,
        deltaQty: 5,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockProduct) // Find product
        .mockResolvedValueOnce(mockProductStock); // Find stock

      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockProductStock,
        quantity: 15,
      });

      const result = await service.adjustProductStock(adjustDto);

      expect(result.quantity).toBe(15);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should decrease stock quantity', async () => {
      const adjustDto = {
        productId: mockProduct.id,
        deltaQty: -3,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockProductStock);

      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockProductStock,
        quantity: 7,
      });

      const result = await service.adjustProductStock(adjustDto);

      expect(result.quantity).toBe(7);
    });

    it('should throw ConflictException if stock becomes negative', async () => {
      const adjustDto = {
        productId: mockProduct.id,
        deltaQty: -20, // More than available
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce(mockProductStock);

      await expect(service.adjustProductStock(adjustDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete product', async () => {
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockProductRepository.softRemove.mockResolvedValue(mockProduct);

      await service.remove(mockProduct.id);

      expect(mockProductRepository.softRemove).toHaveBeenCalledWith(
        mockProduct,
      );
    });
  });
});
