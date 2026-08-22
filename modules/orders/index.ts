"use client";

/**
 * Client-side order data hooks.
 *
 * order_items uses product_id (UUID FK) for all product references.
 * OrderItem.type removed — product name is the full identifier.
 *
 * Reads via Supabase public client (RLS: user reads own orders only).
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import type { Order, OrderEvent, OrderItem, OrderStatus, ProductVisualKey } from "@/types";

type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  currency: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  ship_label: string;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_state: string;
  ship_postcode: string;
  ship_country: string;
  ship_phone: string;
  tracking_number: string | null;
  estimated_delivery: string | null;
  placed_at: string;
};

type OrderItemRow = {
  id: number;
  order_id: string;
  product_id: string | null;  // UUID FK — may be null if product was deleted
  product_name: string;
  visual_key: string;
  accent: string;
  quantity: number;
  unit_price: number;
  line_discount: number;
  line_total: number;
};

type TimelineRow = {
  id: number;
  order_id: string;
  step_label: string;
  step_date: string | null;
  step_index: number;
  done: boolean;
};

type EventRow = {
  id: string;
  order_id: string;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function mapOrder(
  row: OrderRow,
  items: OrderItemRow[],
  timeline: TimelineRow[],
  events: EventRow[]
): Order {
  const orderItems: OrderItem[] = items.map((i) => ({
    productId: i.product_id ?? undefined,
    name: i.product_name,
    visualKey: i.visual_key as ProductVisualKey,
    accent: i.accent,
    quantity: i.quantity,
    unitPrice: i.unit_price,
  }));

  const orderEvents: OrderEvent[] = events
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((e) => ({
      id: e.id,
      eventType: e.event_type,
      createdAt: e.created_at,
      metadata: e.metadata ?? undefined,
    }));

  return {
    id: row.id,
    orderNumber: row.order_number ?? undefined,
    date: row.placed_at,
    status: row.status as OrderStatus,
    items: orderItems,
    subtotal: row.subtotal,
    discount: row.discount_total,
    shipping: row.shipping_total,
    tax: row.tax_total,
    total: row.total,
    address: {
      id: "",
      label: row.ship_label,
      line1: row.ship_line1,
      line2: row.ship_line2 ?? undefined,
      city: row.ship_city,
      state: row.ship_state,
      postcode: row.ship_postcode,
      country: row.ship_country,
      phone: row.ship_phone,
      isDefault: false,
    },
    paymentMethod: row.payment_method === "cod" ? "Cash on delivery" : row.payment_method,
    trackingNumber: row.tracking_number ?? undefined,
    estimatedDelivery: row.estimated_delivery ?? undefined,
    events: orderEvents,
    timeline: timeline
      .sort((a, b) => a.step_index - b.step_index)
      .map((t) => ({
        label: t.step_label,
        date: t.step_date ?? "",
        done: t.done,
      })),
  };
}

export function useOrders() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setOrders([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();

      const { data: orderRows, error } = await supabase
        .from("orders")
        .select("*")
        .order("placed_at", { ascending: false });

      if (error || !orderRows || cancelled) { setOrders([]); setLoading(false); return; }

      const orderIds = (orderRows as OrderRow[]).map((o) => o.id);
      if (orderIds.length === 0) { setOrders([]); setLoading(false); return; }

      const [itemsRes, timelineRes, eventsRes] = await Promise.all([
        supabase.from("order_items").select("*").in("order_id", orderIds),
        supabase.from("order_timeline").select("*").in("order_id", orderIds),
        supabase.from("order_events").select("*").in("order_id", orderIds),
      ]);

      if (cancelled) return;

      const items     = (itemsRes.data    ?? []) as OrderItemRow[];
      const timelines = (timelineRes.data ?? []) as TimelineRow[];
      const events    = (eventsRes.data   ?? []) as EventRow[];

      const mapped = (orderRows as OrderRow[]).map((row) =>
        mapOrder(
          row,
          items.filter((i) => i.order_id === row.id),
          timelines.filter((t) => t.order_id === row.id),
          events.filter((e) => e.order_id === row.id)
        )
      );

      setOrders(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { orders, loading };
}

export function useOrder(id: string) {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setOrder(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();

      const { data: orderRow, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !orderRow || cancelled) { setOrder(null); setLoading(false); return; }

      const [itemsRes, timelineRes, eventsRes] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase.from("order_timeline").select("*").eq("order_id", id),
        supabase.from("order_events").select("*").eq("order_id", id),
      ]);

      if (cancelled) return;

      setOrder(mapOrder(
        orderRow as OrderRow,
        (itemsRes.data    ?? []) as OrderItemRow[],
        (timelineRes.data ?? []) as TimelineRow[],
        (eventsRes.data   ?? []) as EventRow[]
      ));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, userId]);

  return { order, loading };
}
