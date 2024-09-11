import {
  BillingSchedules,
  BillingStatus,
  ServicePriority,
  ServiceStatus,
  ShipMethod,
} from "../utils/types/enum/db";

export const PRIORITY = [
  {
    title: ServicePriority.High,
    description: "",
  },
  {
    title: ServicePriority.Medium,
    description: "",
  },
  {
    title: ServicePriority.Low,
    description: "",
  },
];

export const STATUS = [
  {
    title: ServiceStatus.Created,
    description: "",
  },
  {
    title: ServiceStatus.Dispatched,
    description: "",
  },
  {
    title: ServiceStatus.Hold,
    description: "",
  },
  {
    title: ServiceStatus.Completed,
    description: "",
  },
  {
    title: ServiceStatus.Failed,
    description: "",
  },
];

export const BILL_STATUS = [
  {
    title: BillingStatus.Pending,
    description: "",
  },
  {
    title: BillingStatus.Paid,
    description: "",
  },
];

// schedules;
export const BILL_SCHEDULES = [
  {
    title: BillingSchedules.Monthly,
    description: "twelve times a year",
  },
  {
    title: BillingSchedules.Quarterly,
    description: "four times a year",
  },
  {
    title: BillingSchedules.HALF_YEARLY,
    description: "Half-yearly",
  },
  {
    title: BillingSchedules.ANNUALLY,
    description: "Once a year",
  },
];

export const SHIP_METHOD = [
  {
    title: ShipMethod.DLTECH,
    description: "",
  },
  {
    title: ShipMethod.SHIPPED,
    description: "",
  },
];

export const DURATION = [1, 5];
