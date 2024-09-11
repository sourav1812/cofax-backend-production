export enum ServiceStatus {
  Created = "created",
  Dispatched = "dispatched",
  Hold = "hold",
  Completed = "completed",
  Failed = "failed",
}

export enum ServicePriority {
  High = "high",
  Medium = "medium",
  Low = "low",
}

export enum UserRole {
  Technician = "technician",
  Admin = "Admin",
  SuperAdmin = "super-admin",
}

export enum ProductCondition {
  New = "new",
  Used = "used",
  Reassembled = "reassembled",
  Refurbished = "refurbished",
}

export enum BillingStatus {
  Pending = "pending",
  Paid = "paid",
  OVER_DUE = "over due",
  FAILED = "failed",
}

export enum ShipMethod {
  DLTECH = "DLTECH",
  SHIPPED = "Shipped",
}

export enum BillingSchedules {
  Monthly = "monthly",
  Quarterly = "quarterly",
  HALF_YEARLY = "half yearly",
  ANNUALLY = "annually",
}

export enum ReportType {
  Sync = "sync",
  Bill = "bill",
}
