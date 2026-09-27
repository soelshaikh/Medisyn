import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi, type CartSummary } from "@/api/cart.api";

export const CART_KEY = ["cart"] as const;

export function useCart() {
  return useQuery<CartSummary>({
    queryKey: CART_KEY,
    queryFn:  cartApi.get,
    staleTime: 30_000,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      cartApi.addItem(productId, quantity),
    onSuccess: (data) => qc.setQueryData(CART_KEY, data),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      cartApi.updateItem(productId, quantity),
    onSuccess: (data) => qc.setQueryData(CART_KEY, data),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => cartApi.removeItem(productId),
    onSuccess: (data) => qc.setQueryData(CART_KEY, data),
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: (data) => qc.setQueryData(CART_KEY, data),
  });
}

export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: (data) => qc.setQueryData(CART_KEY, data),
  });
}
