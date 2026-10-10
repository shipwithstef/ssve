// Customers download PDF receipts for their own bookings.
import fs from "node:fs";
import path from "node:path";

export const RECEIPTS_DIR = path.resolve(process.env.RECEIPTS_DIR || "data/receipts");

export function receiptPath(userId, receiptId) {
  return path.join(RECEIPTS_DIR, userId, `${receiptId}.pdf`);
}

export function readReceipt(userId, receiptId) {
  return fs.readFileSync(receiptPath(userId, receiptId));
}
