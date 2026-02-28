import { Order } from "@/types";
import { hashWalletIdentity } from "@/lib/identity";

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
  const normalized = wallet.trim().toLowerCase();
  const hashed = hashWalletIdentity(normalized);
  return getOrders().filter((o) => {
    const legacy = (o.patientWallet || "").trim().toLowerCase();
    const identity = (o.patientWalletHash || "").trim().toLowerCase();
    return legacy === normalized || identity === hashed.toLowerCase();
  });
}

export function getOrdersByCourier(wallet: string): Order[] {
  const target = wallet.trim().toLowerCase();
  return getOrders().filter((o) => (o.courierWallet || "").trim().toLowerCase() === target);
}

export function getAvailableOrders(): Order[] {
  return getOrders().filter((o) => o.status === "funded");
}

function redactOrderForCourier(order: Order): Order {
  return {
    ...order,
    patientWallet: undefined,
    patientWalletHash: undefined,
    compliancePatientToken: undefined,
  };
}

export function getAvailableOrdersForCourier(): Order[] {
  return getAvailableOrders().map(redactOrderForCourier);
}

export function getOrdersByCourierForCourier(wallet: string): Order[] {
  return getOrdersByCourier(wallet).map(redactOrderForCourier);
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
