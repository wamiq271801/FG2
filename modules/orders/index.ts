"use client";

/**
 * Client-side order data hooks.
 * Reads orders via direct Supabase (RLS: auth.uid() = user_id, read-own only).
 * No Worker, no API routes — orders are read-only to the user.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem, OrderStatus, ProductVisualKey } from "@/types";

type OrderRow = {
  id: string;
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
  product_slug: string | null;
  product_name: string;
  variant_name: string | null;
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

function mapOrder(row: OrderRow, items: OrderItemRow[], timeline: TimelineRow[]): Order {
  const orderItems: OrderItem[] = items.map((i) => ({
    slug: i.product_slug ?? "",
    name: i.product_name,
    image: "",
    visualKey: i.visual_key as ProductVisualKey,
    accent: i.accent,
    variant: i.variant_name ?? undefined,
    quantity: i.quantity,
    unitPrice: i.unit_price,
  }));

  return {
    id: row.id,
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
    timeline: timeline.map((t) => ({
      label: t.step_label,
      date: t.step_date ?? "",
      done: t.done,
    })),
  };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setOrders([]);
        setLoading(false);
        return;
      }
      const { data: orderRows, error } = await supabase
        .from("orders")
        .select("*")
        .order("placed_at", { ascending: false });
      if (error || !orderRows || cancelled) {
        setOrders([]);
        setLoading(false);
        return;
      }
      // Fetch items + timeline for each order
      const orderIds = (orderRows as OrderRow[]).map((o) => o.id);
      if (orderIds.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }
      const [itemsRes, timelineRes] = await Promise.all([
        supabase.from("order_items").select("*").in("order_id", orderIds),
        supabase.from("order_timeline").select("*").in("order_id", orderIds),
      ]);
      if (cancelled) return;
      const items = (itemsRes.data ?? []) as OrderItemRow[];
      const timelines = (timelineRes.data ?? []) as TimelineRow[];

      const mapped = (orderRows as OrderRow[]).map((row) => {
        const orderItems = items.filter((i) => i.order_id === row.id);
        const orderTimeline = timelines
          .filter((t) => t.order_id === row.id)
          .sort((a, b) => a.step_index - b.step_index);
        return mapOrder(row, orderItems, orderTimeline);
      });
      setOrders(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { orders, loading };
}

export function useOrder(id: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setOrder(null);
        setLoading(false);
        return;
      }
      const { data: orderRow, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !orderRow || cancelled) {
        setOrder(null);
        setLoading(false);
        return;
      }
      const row = orderRow as OrderRow;
      const [itemsRes, timelineRes] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", id),
        supabase.from("order_timeline").select("*").eq("order_id", id).order("step_index"),
      ]);
      if (cancelled) return;
      setOrder(mapOrder(row, (itemsRes.data ?? []) as OrderItemRow[], (timelineRes.data ?? []) as TimelineRow[]));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  return { order, loading };
}
