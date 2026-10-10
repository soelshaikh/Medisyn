import { Router } from 'express';
import { cartRouter } from './cart/cart.router';
import { shippingMethodRouter } from './shipping-methods/shipping-method.router';
import { checkoutRouter } from './checkout/checkout.router';
import { orderRouter } from './orders/order.router';

export const commerceRouter = Router();

commerceRouter.use(cartRouter);
commerceRouter.use(shippingMethodRouter);
commerceRouter.use(checkoutRouter);
commerceRouter.use(orderRouter);
