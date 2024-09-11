import path from "path";
import ejs from "ejs";
import { viewPath } from "../../constant/view";

export function generateRandomNumberInRange() {
  // Generate a random number between 100 (inclusive) and 1000 (exclusive)
  const randomNumberInRange =
    Math.floor(Math.random() * (9990 - 1000 + 1)) + 1000;

  return randomNumberInRange;
}

export function getCurrentYear() {
  // Generate a random number between 1000 (inclusive) and 10000 (exclusive)
  return new Date()
    .toLocaleDateString("pl", {
      day: "numeric",
      month: "numeric",
      year: "2-digit",
    })
    .split(".")[2];
}

export function isSameYearMonth(currentDate: any, targetDate: any) {
  // Extract year and month components from the current date
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Extract year and month components from the target date
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();

  // Check if the years or months are different
  return currentYear === targetYear && currentMonth === targetMonth;
}

export function convertToSlug(name: string) {
  return name
    .toLowerCase() // Convert to lowercase
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w-]+/g, "") // Remove non-word characters except hyphens
    .replace(/--+/g, "-") // Replace consecutive hyphens with a single hyphen
    .trim(); // Trim leading and trailing hyphens
}

export const mergeAndRemoveItemData = (resp: any) => {
  const mergedItems = resp.items.map((item: any) => {
    const matchingData = resp.itemsData.find(
      (data: any) => String(data._id) === String(item.itemId)
    );

    return {
      itemId: matchingData.itemId,
      name: matchingData.name,
      partId: matchingData._id,
      quantity: item.quantity,
    };
  });

  delete resp.itemsData;

  return [{ ...resp, items: mergedItems }];
};

export const getHtml = async (pathName: string, data: any) => {
  pathName = path.join(__dirname, viewPath, pathName);
  return await ejs.renderFile(pathName, data);
};

export function convertDateFormat(inputDate: any) {
  const dateObject = new Date(inputDate);

  // Check if the inputDate is a valid date
  if (isNaN(dateObject.getTime())) {
    return "Invalid date";
  }

  // Format the date into "YYYY-MM-DD" format
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, "0");
  const day = String(dateObject.getDate()).padStart(2, "0");

  const formattedDate = inputDate ? `${month}/${day}/${year}` : null;
  return formattedDate;
}

export function generateSlug(name: string): string {
  // Convert name to lowercase and replace spaces with dashes
  let slug: string = name.toLowerCase().replace(/\s+/g, "-");

  // Remove special characters and non-alphanumeric characters
  slug = slug.replace(/[^\w\-]+/g, "");

  return slug;
}

export function addCommasToNumber(num: number) {
  // Convert number to string
  let numStr = String(num);

  // Split the string into parts before and after the decimal point (if any)
  let parts = numStr.split(".");
  let integerPart = parts[0];
  let decimalPart = parts.length > 1 ? "." + parts[1] : "";

  // Add commas to the integer part (thousands separator)
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Join the integer and decimal parts back together
  return integerPart + decimalPart;
}

export function isOlderByMonths(
  oldDate: string,
  billingSchedule: string
): boolean {
  // Parse the old date string to a Date object
  if (!oldDate) return false;
  const parsedOldDate = new Date(oldDate);

  // Get the current date
  const currentDate = new Date();

  // Calculate the date that is numberOfMonths ago from the current date
  const numberOfMonths: number = getDate(billingSchedule);
  const monthsAgoDate = new Date(currentDate);
  monthsAgoDate.setMonth(currentDate.getMonth() - numberOfMonths);

  // Compare the parsedOldDate with monthsAgoDate
  return parsedOldDate < monthsAgoDate;
}

export function calculateRentalBasedOnBillingSchedule(
  rentalAmount: number,
  billingSchedule: string
) {
  if (!rentalAmount && billingSchedule) return 0 * 1;
  const monthToMultiplyWithRentalAmt = getDate(billingSchedule);
  return rentalAmount * monthToMultiplyWithRentalAmt;
}

export const getDate = (billingSchedule: string) => {
  switch (billingSchedule) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "half yearly":
      return 6;
    case "annually":
      return 12;
    default:
      return 1;
  }
};

export const createHashSet = async (readings: any) => {
  const hashSet = new Map();
  for (const reading of readings.data.Result) {
    const counterLen = reading.Counters.length;
    hashSet.set(reading.AssetNumber, {
      mono: reading.Counters[counterLen - 1].Mono ?? 0,
      color: reading.Counters[counterLen - 1].Color ?? 0,
    });
  }

  return hashSet;
};

export const firstAndLastDateOfMonth = (d: Date) => {
  const date = new Date(d);

  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  console.log("startOfMonth, endOfMonth", d, startOfMonth, endOfMonth);

  return [startOfMonth, endOfMonth];
};
