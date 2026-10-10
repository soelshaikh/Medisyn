import { Router } from 'express';
import { productRouter } from './products/product.router';
import { categoryRouter } from './categories/category.router';
import { inventoryRouter } from './inventory/inventory.router';
import { couponRouter } from './coupons/coupon.router';

export const catalogueRouter = Router();

catalogueRouter.use('/products', productRouter);
catalogueRouter.use('/categories', categoryRouter);
catalogueRouter.use('/inventory', inventoryRouter);
catalogueRouter.use('/coupons', couponRouter);
