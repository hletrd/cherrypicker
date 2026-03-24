export interface Transaction {
  id: string;
  date: string;          // ISO 8601
  merchant: string;      // Original merchant name from statement
  amount: number;        // Won (positive = spending)
  currency: string;      // KRW default
  installments?: number; // 할부 개월
  isOnline?: boolean;
  rawCategory?: string;  // Bank's own category if present
  memo?: string;
}

export interface CategorizedTransaction extends Transaction {
  category: string;      // Mapped to canonical category ID
  subcategory?: string;
  confidence: number;    // 0-1 matching confidence
}
