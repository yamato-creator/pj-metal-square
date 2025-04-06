// src/types/types.ts
export interface Metal {
    name: string;
    nameJp: string;
    amount: number;
    unitPrice: number;
  }
  
  export interface SaleHistory {
    id: string;
    date: string;
    company: string;
    items: {
      metalName: string;
      amount: number;
      unitPrice: number;
      total: number;
    }[];
    subtotal: number;
    tax: number;
    total: number;
  }