import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderService } from './order.service';
import { OrderEntity } from './entities/order.entity';
import { OrderDepositsEntity } from './entities/order-deposits.entity';
import { OrderChangeEntity } from './entities/order-change.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { DenominationEntity } from '../cash/entities/denomination.entity';
import { CashService } from '../cash/cash.service';
import { ProductService } from '../products/product.service';
import { OrderStatus } from 'src/shares/enums/order';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('OrderService', () => {
  let service: OrderService;

  const mockProduct = {
    id: 'product-123',
    name: 'Coca Cola',
    price: 20,
    sku: 'COKE-001',
    isActive: true,
    productStock: { quantity: 10 },
  };

  const mockDenomination = {
    id: 'denom-123',
    amount: 20,
    type: 'BILL',
    isActive: true,
  };

  const mockOrder = {
    id: 'order-123',
    status: OrderStatus.IN_PROGRESS,
    paidAmount: 0,
    creditAmount: 0,
    changeAmount: 0,
    product: null,
    deposits: [],
    change: [],
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockOrderRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockCashService = {
    calculateChange: jest.fn(),
    adjustCashStock: jest.fn(),
  };

  const mockProductService = {
    adjustProductStock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(OrderDepositsEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(OrderChangeEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(DenominationEntity),
          useValue: {},
        },
        {
          provide: CashService,
          useValue: mockCashService,
        },
        {
          provide: ProductService,
          useValue: mockProductService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create new order with IN_PROGRESS status', async () => {
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      const result = await service.createOrder();

      expect(result.orderId).toBe(mockOrder.id);
      expect(mockOrderRepository.save).toHaveBeenCalled();
    });
  });

  describe('getOrder', () => {
    it('should return order with all relations', async () => {
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        product: mockProduct,
        deposits: [{ denomination: mockDenomination, quantity: 1 }],
      });

      const result = await service.getOrder(mockOrder.id);

      expect(result.id).toBe(mockOrder.id);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        relations: expect.any(Object),
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrder('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('depositMoney', () => {
    it('should create new order if orderId not provided', async () => {
      const depositDto = {
        denominationId: mockDenomination.id,
        qty: 2,
      };

      const newOrder = {
        id: 'new-order-123',
        status: OrderStatus.IN_PROGRESS,
        paidAmount: 0,
        creditAmount: 0,
        changeAmount: 0,
      };

      mockQueryRunner.manager.create.mockReturnValueOnce(newOrder);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(newOrder) // Save new order
        .mockResolvedValueOnce({}) // Save deposit
        .mockResolvedValueOnce({
          ...newOrder,
          paidAmount: 40, // 20 * 2
          creditAmount: 40,
        }); // Save order with amounts

      mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockDenomination); // Find denomination

      const result = await service.depositMoney(depositDto);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('new-order-123');
      expect(result.depositAmount).toBe(40); // 20 * 2
      expect(result.totalAmount).toBe(40);
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(OrderEntity, {
        status: OrderStatus.IN_PROGRESS,
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should record deposit and update paidAmount with existing orderId', async () => {
      const depositDto = {
        orderId: mockOrder.id,
        denominationId: mockDenomination.id,
        qty: 2,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOrder) // Find order
        .mockResolvedValueOnce(mockDenomination); // Find denomination

      mockQueryRunner.manager.create.mockReturnValue({});
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({}) // Save deposit
        .mockResolvedValueOnce({
          ...mockOrder,
          id: mockOrder.id,
          paidAmount: 40, // 20 * 2
          creditAmount: 40,
        }); // Save order

      const result = await service.depositMoney(depositDto);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(mockOrder.id);
      expect(result.depositAmount).toBe(40); // 20 * 2
      expect(result.totalAmount).toBe(40);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if order is not IN_PROGRESS', async () => {
      const depositDto = {
        orderId: mockOrder.id,
        denominationId: mockDenomination.id,
        qty: 1,
      };

      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.SUCCESS,
      });

      await expect(service.depositMoney(depositDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if denomination is inactive', async () => {
      const depositDto = {
        orderId: mockOrder.id,
        denominationId: mockDenomination.id,
        qty: 1,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockDenomination, isActive: false });

      await expect(service.depositMoney(depositDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('selectProduct', () => {
    it('should return success response with orderId and productId', async () => {
      const selectDto = {
        orderId: mockOrder.id,
        productId: mockProduct.id,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockOrder, paidAmount: 50 })
        .mockResolvedValueOnce(mockProduct);

      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockOrder,
        product: mockProduct,
        paidAmount: 50,
        creditAmount: 30, // 50 - 20
      });

      const result = await service.selectProduct(selectDto);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(mockOrder.id);
      expect(result.productId).toBe(mockProduct.id);
    });

    it('should throw ConflictException if product is out of stock', async () => {
      const selectDto = {
        orderId: mockOrder.id,
        productId: mockProduct.id,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({
          ...mockProduct,
          productStock: { quantity: 0 },
        });

      await expect(service.selectProduct(selectDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if product is inactive', async () => {
      const selectDto = {
        orderId: mockOrder.id,
        productId: mockProduct.id,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockProduct, isActive: false });

      await expect(service.selectProduct(selectDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('purchase', () => {
    it('should complete transaction with exact payment (no change)', async () => {
      const orderWithProduct = {
        ...mockOrder,
        product: mockProduct,
        paidAmount: 20, // Exact price
        deposits: [{ denomination: mockDenomination, quantity: 1 }],
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(orderWithProduct);
      mockCashService.calculateChange.mockResolvedValue({
        success: true,
        breakdown: [],
      });
      mockProductService.adjustProductStock.mockResolvedValue({});
      mockCashService.adjustCashStock.mockResolvedValue({});
      mockQueryRunner.manager.save.mockResolvedValue({
        ...orderWithProduct,
        status: OrderStatus.SUCCESS,
      });

      const result = await service.purchase(mockOrder.id);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(mockOrder.id);
      expect(result.changeAmount).toBe(0);
      expect(result.change).toEqual([]);
      expect(mockProductService.adjustProductStock).toHaveBeenCalledWith(
        { productId: mockProduct.id, deltaQty: -1 },
        mockQueryRunner,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should complete transaction with change', async () => {
      const orderWithProduct = {
        ...mockOrder,
        product: mockProduct,
        paidAmount: 50,
        deposits: [
          { denomination: { ...mockDenomination, amount: 50 }, quantity: 1 },
        ],
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(orderWithProduct);
      mockCashService.calculateChange.mockResolvedValue({
        success: true,
        totalAmount: 30,
        breakdown: [
          { denominationId: 'denom-20', amount: 20, qty: 1 },
          { denominationId: 'denom-10', amount: 10, qty: 1 },
        ],
      });
      mockProductService.adjustProductStock.mockResolvedValue({});
      mockCashService.adjustCashStock.mockResolvedValue({});
      mockQueryRunner.manager.create.mockReturnValue({});
      mockQueryRunner.manager.save.mockResolvedValue({
        ...orderWithProduct,
        status: OrderStatus.SUCCESS,
        changeAmount: 30,
      });

      const result = await service.purchase(mockOrder.id);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(mockOrder.id);
      expect(result.changeAmount).toBe(30);
      expect(result.change).toEqual([
        { amount: 20, quantity: 1 },
        { amount: 10, quantity: 1 },
      ]);
      expect(mockCashService.adjustCashStock).toHaveBeenCalledTimes(3); // 1 deposit + 2 change
    });

    it('should throw BadRequestException if no product selected', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockOrder,
        product: null,
      });

      await expect(service.purchase(mockOrder.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if insufficient payment', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockOrder,
        product: mockProduct,
        paidAmount: 10, // Less than price (20)
      });

      await expect(service.purchase(mockOrder.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if cannot make change', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockOrder,
        product: mockProduct,
        paidAmount: 50,
        deposits: [],
      });

      mockCashService.calculateChange.mockResolvedValue({
        success: false,
        message: 'Cannot make exact change',
      });

      await expect(service.purchase(mockOrder.id)).rejects.toThrow(
        ConflictException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('cancelOrder', () => {
    it('should return success response with refund amount', async () => {
      const cancelDto = {
        orderId: mockOrder.id,
        reason: 'Customer changed mind',
      };

      const orderWithDeposits = {
        ...mockOrder,
        paidAmount: 40,
        deposits: [
          {
            denomination: { id: 'denom-20', amount: 20 },
            quantity: 2,
          },
        ],
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(orderWithDeposits);
      mockQueryRunner.manager.create.mockReturnValue({});
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({}) // Save refund record
        .mockResolvedValueOnce({
          ...mockOrder,
          status: OrderStatus.CANCELLED,
          changeAmount: 40,
          remark: cancelDto.reason,
        });

      const result = await service.cancelOrder(cancelDto);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(mockOrder.id);
      expect(result.refundAmount).toBe(40);
      expect(mockQueryRunner.manager.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if order is not IN_PROGRESS', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.SUCCESS,
      });

      await expect(
        service.cancelOrder({ orderId: mockOrder.id }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow cancel after failed purchase (e.g., cannot make change)', async () => {
      const cancelDto = {
        orderId: mockOrder.id,
        reason: 'Cannot make change, cancelling order',
      };

      // Order still IN_PROGRESS after failed purchase
      const orderAfterFailedPurchase = {
        ...mockOrder,
        status: OrderStatus.IN_PROGRESS, // Still IN_PROGRESS
        paidAmount: 50,
        product: mockProduct,
        deposits: [
          {
            denomination: { id: 'denom-50', amount: 50 },
            quantity: 1,
          },
        ],
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(
        orderAfterFailedPurchase,
      );
      mockQueryRunner.manager.create.mockReturnValue({});
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({}) // Save refund
        .mockResolvedValueOnce({
          ...orderAfterFailedPurchase,
          status: OrderStatus.CANCELLED,
          changeAmount: 50,
        });

      const result = await service.cancelOrder(cancelDto);

      expect(result.success).toBe(true);
      expect(result.refundAmount).toBe(50);
    });
  });

  describe('listOrders', () => {
    it('should return all orders ordered by creation date DESC', async () => {
      const mockOrders = [mockOrder, { ...mockOrder, id: 'order-456' }];

      mockOrderRepository.find.mockResolvedValue(mockOrders);

      const result = await service.listOrders();

      expect(result).toEqual(mockOrders);
      expect(mockOrderRepository.find).toHaveBeenCalledWith({
        relations: expect.any(Object),
        order: { createdAt: 'DESC' },
      });
    });
  });
});
