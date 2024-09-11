import { addCommasToNumber, calculateRentalBasedOnBillingSchedule } from ".";
import ServiceBilling from "../../schema/Invoices/service";
import MeterReading from "../../schema/meterReading.schema";

export const ServiceBillCalculation = async (
  serviceInvoice: any,
  hstTax: number
) => {
  for (const assetAndMeterReading of serviceInvoice.assets) {
    const prevMeterReading = await fetchPreviousReading(
      { customerName: serviceInvoice.customerName },
      assetAndMeterReading
    );

    serviceInvoice.prevMeterReading = prevMeterReading;
    const {
      monoBegin = 0,
      colorBegin = 0,
      colorPrice = 0,
      monoPrice = 0,
      coveredMono = 0,
      coveredColor = 0,
      assetNumber,
      contractAmount = 0,
      baseAdj = 0,
      rentalCharge = 0,
    } = assetAndMeterReading.asset;

    const { prevMono = monoBegin, prevColor = colorBegin } =
      serviceInvoice?.prevMeterReading || {};
    const {
      mono: currMono,
      color: currColor,
      sent,
    } = assetAndMeterReading.meterReading;

    const contractName = assetAndMeterReading.asset.contractType.name;
    const flagIfNotFlat = !contractName.toLowerCase().includes("flat");

    // Rental charge with reference to billing schedule
    const rentalWithBillingSchedule = calculateRentalBasedOnBillingSchedule(
      rentalCharge,
      serviceInvoice?.customer?.billingSchedules
    );

    if (flagIfNotFlat) {
      const monoTotalDiff = currMono - prevMono;
      const colorTotalDiff = currColor - prevColor;

      const monoMeter = {
        meterType: "B/W",
        meterGroup: assetNumber,
        BeginMeter: addCommasToNumber(prevMono),
        EndMeter: addCommasToNumber(currMono),
        total: addCommasToNumber(monoTotalDiff),
        covered: addCommasToNumber(coveredMono),
        rate: monoPrice,
        billable: "0",
        overage: "0",
      };

      const colorMeter = {
        meterType: "Color",
        meterGroup: assetNumber,
        BeginMeter: addCommasToNumber(prevColor),
        EndMeter: addCommasToNumber(currColor),
        total: addCommasToNumber(colorTotalDiff),
        covered: addCommasToNumber(coveredColor),
        rate: colorPrice,
        billable: "0",
        overage: "0",
      };

      //Bill Calculaions
      const monobillable =
        coveredMono <= monoTotalDiff ? monoTotalDiff - coveredMono : 0;

      monoMeter.billable = addCommasToNumber(monobillable);

      const colorBillable =
        coveredColor <= colorTotalDiff ? colorTotalDiff - coveredColor : 0;

      colorMeter.billable = addCommasToNumber(colorBillable);

      const monoOverage = monobillable * monoPrice;
      monoMeter.overage = addCommasToNumber(monoOverage);

      const colorOverage = colorBillable * colorPrice;
      colorMeter.overage = addCommasToNumber(colorOverage);

      const totalOverage = monoOverage + colorOverage;

      const subTotal =
        contractAmount + rentalWithBillingSchedule + totalOverage;
      const hst = addTrailingZeros(subTotal * (hstTax / 100));

      const finalAmount =
        subTotal - baseAdj + Number(subTotal * (hstTax / 100));

      const balanceDue = addTrailingZeros(
        finalAmount - (serviceInvoice.status === "paid" ? finalAmount : 0)
      );

      assetAndMeterReading.meterReading = {
        readings: [monoMeter, colorMeter],
        totalOverage: totalOverage,
        subTotal: subTotal,
        discount: 0,
        balanceDue,
        sent,
        hst: Number(hst),
        totalTax: Number(hst),
        total: Number(finalAmount),
        totalWithRentalCharge: rentalWithBillingSchedule
          ? Number(finalAmount) + Number(rentalWithBillingSchedule)
          : Number(finalAmount),
        contractAmount: addCommasToNumber(contractAmount ?? 0),
      };
    } else {
      const totalPrevious = prevMono + prevColor;
      const totalCurrent = currColor + currMono;

      const totalDiff = totalCurrent - totalPrevious;

      const meter = {
        meterType: "Total Count",
        meterGroup: assetNumber,
        BeginMeter: addCommasToNumber(totalPrevious),
        EndMeter: addCommasToNumber(totalCurrent),
        total: addCommasToNumber(totalDiff),
        covered: coveredMono + coveredColor,
        rate: Math.max(monoPrice, colorPrice),
        billable: "0",
        overage: "0",
      };

      const billable = coveredMono <= totalDiff ? totalDiff - meter.covered : 0;
      meter.billable = addCommasToNumber(billable);

      const overage = billable * meter.rate;
      meter.overage = addCommasToNumber(overage);

      meter.covered = addCommasToNumber(meter.covered);

      const subTotal = contractAmount + rentalWithBillingSchedule + overage;
      const hst = addTrailingZeros(subTotal * (hstTax / 100));

      const finalAmount =
        subTotal - baseAdj + Number(subTotal * (hstTax / 100));

      const balanceDue = addTrailingZeros(
        finalAmount - (serviceInvoice.status === "paid" ? finalAmount : 0)
      );

      assetAndMeterReading.meterReading = {
        readings: [meter],
        totalOverage: meter.overage,
        subTotal: Number(subTotal),
        discount: 0,
        sent,
        balanceDue,
        hst: Number(hst),
        totalTax: Number(hst),
        total: Number(finalAmount),
        totalWithRentalCharge: rentalWithBillingSchedule
          ? Number(finalAmount) + Number(rentalWithBillingSchedule)
          : Number(finalAmount),
        contractAmount: addCommasToNumber(contractAmount ?? 0),
      };
    }
  }

  return serviceInvoice;
};

const fetchPreviousReading = async (props: any, asset: any) => {
  try {
    const prevMeterReading = await MeterReading.findOne({
      assetId: asset.assetId,
      username: props.customerName,
      invoiced: true,
      createdAt: { $lt: asset.meterReading.createdAt },
    });
    return prevMeterReading
      ? {
          prevMono: prevMeterReading.mono,
          prevColor: prevMeterReading.color,
        }
      : null;
  } catch (error) {
    console.error("Error fetching previous meter reading:", error);
    return null;
  }
};

export function addTrailingZeros(number: number) {
  // Convert the number to a string
  const numberString = number.toString();

  // Check if the number has a decimal point
  if (numberString.includes(".")) {
    const [integerPart, decimalPart] = numberString.split(".");

    // Add trailing zeros to the decimal part if needed
    const formattedDecimalPart = decimalPart.padEnd(2, "0").slice(0, 2);

    // Join the integer and formatted decimal parts with a dot
    return `${integerPart}.${formattedDecimalPart}`;
  } else {
    // If there is no decimal point, add '.00'
    return `${number}.00`;
  }
}

export function isArrayEffectivelyEmpty(arr: any) {
  if (!arr && arr?.length) return true;
  return arr?.every((obj: any) => Object.keys(obj).length === 0);
}

export function calculateOverallTotal(assets: any) {
  const obj = {
    totalOverage: 0,
    subTotal: 0,
    discount: 0,
    balanceDue: 0,
    sent: 1,
    hst: 0,
    totalTax: 0,
    total: 0,
    totalWithRentalCharge: 0,
  };
  assets?.forEach(({ meterReading }: any) => {
    obj.totalOverage += +meterReading?.totalOverage;
    obj.subTotal += +meterReading?.subTotal;
    obj.discount += +meterReading?.discount;
    obj.balanceDue += +meterReading?.balanceDue;
    obj.sent = meterReading?.sent;
    obj.hst += +meterReading?.hst;
    obj.totalTax += +meterReading?.totalTax;
    obj.total += +meterReading?.total;
    obj.totalWithRentalCharge += +meterReading?.totalWithRentalCharge;
    return;
  });

  return {
    ...obj,
    totalOverage: addCommasToNumber(obj.totalOverage),
    subTotal: addCommasToNumber(Number(addTrailingZeros(obj.subTotal))),
    hst: addCommasToNumber(Number(obj.hst)),
    totalTax: addCommasToNumber(Number(obj.totalTax)),
    total: addCommasToNumber(Number(addTrailingZeros(obj.total))),
    totalWithRentalCharge: addCommasToNumber(
      Number(addTrailingZeros(obj.totalWithRentalCharge))
    ),
  };
}
