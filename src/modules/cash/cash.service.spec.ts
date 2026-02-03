import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CashService } from './cash.service';
import { CashStockEntity } from './entities/cash-stock.entity';
import { DenominationEntity } from './entities/denomination.entity';
import { ConflictException } from '@nestjs/common';

describe('CashService', () => {
  let service: CashService;
  // let denominationRepository: Repository<DenominationEntity>;
  let dataSource: DataSource;

  const mockDenomination = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    amount: 20,
    type: 'BILL' as any,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCashStock = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    denomination: mockDenomination,
    quantity: 100,
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
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockCashStockRepository = {
    findOne: jest.fn(),
  };

  const mockDenominationRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashService,
        {
          provide: getRepositoryToken(CashStockEntity),
          useValue: mockCashStockRepository,
        },
        {
          provide: getRepositoryToken(DenominationEntity),
          useValue: mockDenominationRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CashService>(CashService);
    // const denominationRepository = module.get<Repository<DenominationEntity>>(
    //   getRepositoryToken(DenominationEntity),
    // );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listActiveDenominations', () => {
    it('should return active denominations ordered by amount DESC', async () => {
      const mockDenominations = [
        { ...mockDenomination, amount: 100 },
        { ...mockDenomination, amount: 50 },
        { ...mockDenomination, amount: 20 },
      ];

      mockDenominationRepository.find.mockResolvedValue(mockDenominations);

      const result = await service.listActiveDenominations();

      expect(result).toEqual(mockDenominations);
      expect(mockDenominationRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { amount: 'DESC' },
      });
    });
  });

  describe('validateDenomination', () => {
    it('should return valid=true for active denomination with positive qty', async () => {
      mockDenominationRepository.findOne.mockResolvedValue(mockDenomination);

      const result = await service.validateDenomination({
        denominationId: mockDenomination.id,
        qty: 1,
      });

      expect(result.valid).toBe(true);
    });

    it('should return valid=false if denomination not found', async () => {
      mockDenominationRepository.findOne.mockResolvedValue(null);

      const result = await service.validateDenomination({
        denominationId: 'invalid-id',
        qty: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return valid=false if denomination is inactive', async () => {
      mockDenominationRepository.findOne.mockResolvedValue({
        ...mockDenomination,
        isActive: false,
      });

      const result = await service.validateDenomination({
        denominationId: mockDenomination.id,
        qty: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not active');
    });

    it('should return valid=false if quantity <= 0', async () => {
      mockDenominationRepository.findOne.mockResolvedValue(mockDenomination);

      const result = await service.validateDenomination({
        denominationId: mockDenomination.id,
        qty: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('greater than 0');
    });
  });

  describe('adjustCashStock', () => {
    it('should increase cash stock quantity', async () => {
      const adjustDto = {
        denominationId: mockDenomination.id,
        deltaQty: 10,
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockDenomination)
        .mockResolvedValueOnce(mockCashStock);

      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockCashStock,
        quantity: 110,
      });

      const result = await service.adjustCashStock(adjustDto);

      expect(result.quantity).toBe(110);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if stock becomes negative', async () => {
      const adjustDto = {
        denominationId: mockDenomination.id,
        deltaQty: -200, // More than available
      };

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockDenomination)
        .mockResolvedValueOnce(mockCashStock);

      await expect(service.adjustCashStock(adjustDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('calculateChange', () => {
    it('should calculate change breakdown using greedy algorithm', async () => {
      const mockCashStocks = [
        {
          ...mockCashStock,
          denomination: { ...mockDenomination, amount: 100 },
          quantity: 10,
        },
        {
          ...mockCashStock,
          denomination: { ...mockDenomination, amount: 50 },
          quantity: 10,
        },
        {
          ...mockCashStock,
          denomination: { ...mockDenomination, amount: 20 },
          quantity: 10,
        },
        {
          ...mockCashStock,
          denomination: { ...mockDenomination, amount: 10 },
          quantity: 10,
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockCashStocks),
      };

      jest
        .spyOn(dataSource, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.calculateChange({ amountToChange: 180 });

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(180);
      // 180 = 100 + 50 + 20 + 10
      expect(result.breakdown.length).toBeGreaterThan(0);
    });

    it('should return success=false if cannot make exact change', async () => {
      const mockCashStocks = [
        {
          ...mockCashStock,
          denomination: { ...mockDenomination, amount: 50 },
          quantity: 1,
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockCashStocks),
      };

      jest
        .spyOn(dataSource, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.calculateChange({ amountToChange: 25 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot make exact change');
    });

    it('should return success=false if no cash available', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest
        .spyOn(dataSource, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.calculateChange({ amountToChange: 100 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No cash available');
    });

    it('should handle exact amount with minimum denominations', async () => {
      const mockCashStocks = [
        {
          ...mockCashStock,
          denomination: { ...mockDenomination, amount: 20 },
          quantity: 5,
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockCashStocks),
      };

      jest
        .spyOn(dataSource, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.calculateChange({ amountToChange: 60 });

      expect(result.success).toBe(true);
      expect(result.breakdown[0].qty).toBe(3); // 20 * 3 = 60
    });
  });

  describe('getCashStock', () => {
    it('should return cash stock with denominations ordered by amount DESC', async () => {
      const mockStocks = [mockCashStock];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockStocks),
      };

      jest
        .spyOn(dataSource, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getCashStock();

      expect(result).toEqual(mockStocks);
    });
  });
});
