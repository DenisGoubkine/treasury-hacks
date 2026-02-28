import { Order } from "@/types";

const STORAGE_KEY = "phantomdrop_orders";

export function getOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: Order): void {
  const orders = getOrders();
  const index = orders.findIndex((o) => o.id === order.id);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order); // newest first
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function getOrderById(id: string): Order | undefined {
  return getOrders().find((o) => o.id === id);
}

export function getOrdersByPatient(wallet: string): Order[] {
  return getOrders().filter((o) => o.patientWallet === wallet);
}

export function getOrdersByCourier(wallet: string): Order[] {
  return getOrders().filter((o) => o.courierWallet === wallet);
}

export function getAvailableOrders(): Order[] {
  return getOrders().filter((o) => o.status === "funded");
}

export function generateOrderId(): string {
  return `PD-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

export function updateOrderStatus(
  id: string,
  updates: Partial<Order>
): Order | null {
  const order = getOrderById(id);
  if (!order) return null;
  const updated = { ...order, ...updates };
  saveOrder(updated);
  return updated;
}
