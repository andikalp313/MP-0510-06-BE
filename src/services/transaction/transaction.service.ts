import { PrismaClient, TransactionStatus, Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

interface CreateTransactionParams {
  // userId diambil dari token, bukan dari body
  userId: number;
  eventId: number;
  qty: number;
  pointsUsed?: number;
  voucherCode?: string;
  couponCode?: string;
  paymentProof?: string;
  ticketType: "REGULER" | "VIP" | "VVIP";
}

export async function createTransaction({
  userId,
  eventId,
  qty,
  pointsUsed,
  voucherCode,
  couponCode,
  paymentProof,
  ticketType,
}: CreateTransactionParams) {
  return await prisma.$transaction(async (tx) => {
    // Validasi eventId dan ambil detail event
    const event = await tx.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new Error("Invalid eventId");
    }

    // Step 1: Validasi poin user
    if (pointsUsed) {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new Error("User not found");
      if (user.points < pointsUsed) {
        throw new Error("Insufficient points");
      }
    }

    // Step 2: Validasi couponCode
    let coupon = null;
    if (couponCode) {
      coupon = await tx.coupon.findFirst({
        where: { couponCode },
      });
      if (!coupon) throw new Error("Invalid couponCode");
      if (coupon.isUsed) {
        throw new Error("Coupon has already been used");
      }
    }

    // Step 3: Validasi voucherCode
    let voucher: Prisma.VoucherGetPayload<{ include: { user: true } }> | null =
      null;
    if (voucherCode) {
      voucher = await tx.voucher.findFirst({
        where: {
          voucherCode,
          expDate: { gte: new Date() },
        },
        include: {
          user: true,
        },
      });
      if (!voucher) {
        throw new Error("Invalid or expired voucherCode");
      }
      if (voucher.qty <= voucher.usedQty) {
        throw new Error("Voucher quota exceeded");
      }
    }

    // Step 4: Validasi ketersediaan kursi
    let availableSeatsField: keyof Prisma.EventUpdateInput;
    if (ticketType === "REGULER") {
      availableSeatsField = "avaliableSeatsReguler";
    } else if (ticketType === "VIP") {
      availableSeatsField = "avaliableSeatsVip";
    } else if (ticketType === "VVIP") {
      availableSeatsField = "avaliableSeatsVvip";
    } else {
      throw new Error("Invalid ticket type");
    }

    const availableSeats = event[availableSeatsField] as number;
    if (availableSeats < qty) {
      throw new Error("Not enough available seats");
    }

    // Step 5: Hitung harga tiket
    let ticketPrice = 0;
    if (ticketType === "REGULER") ticketPrice = event.priceReguler;
    else if (ticketType === "VIP") ticketPrice = event.priceVip;
    else if (ticketType === "VVIP") ticketPrice = event.priceVvip;

    let totalPrice = ticketPrice * qty;

    // Step 6: Kurangi harga dengan poin
    if (pointsUsed) totalPrice -= pointsUsed;

    // Step 7: Kurangi harga dengan voucher
    if (voucher) totalPrice -= voucher.value;

    // Step 8: Kurangi harga dengan coupon
    if (coupon) totalPrice -= coupon.discountValue;

    // Step 9: Pastikan totalPrice tidak negatif
    if (totalPrice < 0) totalPrice = 0;

    // Step 10: Buat transaksi
    const transaction = await tx.transaction.create({
      data: {
        userId,
        eventId,
        quantity: qty,
        pointsUsed: pointsUsed || 0,
        voucherId: voucher ? voucher.id : undefined,
        couponId: coupon ? coupon.id : undefined,
        paymentProof: paymentProof || "",
        status: TransactionStatus.PENDING,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 jam
        totalPrice,
        ticketType,
      },
    });

    // Step 11: Update jumlah kursi event dengan validasi
    const updatedEvent = await tx.event.updateMany({
      where: {
        id: eventId,
        [availableSeatsField]: { gte: qty },
      },
      data: {
        [availableSeatsField]: { decrement: qty },
      },
    });

    if (updatedEvent.count === 0) {
      throw new Error(
        "Failed to update available seats. Possibly not enough seats."
      );
    }

    // Step 12: Update poin user
    if (pointsUsed) {
      const updatedUser = await tx.user.updateMany({
        where: {
          id: userId,
          points: { gte: pointsUsed },
        },
        data: {
          points: { decrement: pointsUsed },
        },
      });
      if (updatedUser.count === 0) {
        throw new Error(
          "Failed to update user points. Possibly insufficient points."
        );
      }
    }

    // Step 13: Update voucher usage
    if (voucher) {
      const updatedVoucher = await tx.voucher.updateMany({
        where: {
          id: voucher.id,
          qty: { gt: voucher.usedQty },
        },
        data: {
          usedQty: { increment: qty },
        },
      });
      if (updatedVoucher.count === 0) {
        throw new Error(
          "Failed to update voucher usage. Possibly quota exceeded."
        );
      }
    }

    // Step 14: Update coupon usage
    if (coupon) {
      const updatedCoupon = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });
      if (updatedCoupon.count === 0) {
        throw new Error(
          "Failed to update coupon usage. Possibly already used."
        );
      }
    }

    return transaction;
  });
}
