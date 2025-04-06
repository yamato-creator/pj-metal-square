// src/types/master.ts
export interface Department {
    department_id: string;
    department_name: string;
    active_flag: boolean;
  }
  
  export interface KPIData {
    value: number;
    target: number;
    trend: number[];
  }