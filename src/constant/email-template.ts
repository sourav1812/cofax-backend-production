import { convertDateFormat } from "../utils/functions";

export const RESET_PASSWORD = (resetURL: string) => {
  return `
  <p>
      Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: 
      <span style="font-weight: bold"><a href='${resetURL}'>Forgot Password</a></span>.</p>
  <p>If you didn't forget your password, please ignore this email!</p>`;
};

export const SERVICE_INVOICE = (data?: any) => {
  return `
  <p>Dear ${data?.customer?.name},</p>

  <p>We hope this email finds you well. Thank you for choosing ${
    data?.customer?.company?.name
  } for your equipment needs. Attached, you will find the invoice for the services provided during the month of ${convertDateFormat(
    data?.createdAt
  )}.</p>

  <p>Invoice Details:</p>
  <p>Invoice Number: ${data?.invoiceNo}</p>
  <p>Invoice Date: ${convertDateFormat(data?.createdAt)}</p>
  <p>Due Date: ${convertDateFormat(data?.dueDate)}</p>

  <p> Total Amount: $${data?.metaTotal?.total}</p>
  <p> Balance Due: $${data?.metaTotal?.balanceDue}</p>

  <p>Please find the attached invoice for your reference.</p>

  <p>To ensure the continuity of our services, we kindly request you to make the payment by the due date mentioned above.</p>

  <p>If you have already made the payment, please accept our sincere thanks.</p>

  <p>We appreciate your business and look forward to serving you in the future. If you have any questions or concerns regarding the invoice, feel free to reach out to our billing department at [Billing Contact Email/Phone].

  <p>Thank you for being a valued customer.</p>

  <p>Best regards,</p>
  <p>${data?.customer?.company?.name}</p>
`;
};

export const SERVICE_CALL = (data: any) => {
  return `
  <p>${data.serviceCall ?? ""}</p>
  <p>${data.priority ?? ""}</p>
  <p>5/13/2024 3:35:00 PM</p>
  <p>${data.asset?.customer?.name ?? ""}</p>
  <p>${data.asset?.customer?.phoneNumber ?? ""}</p>
  <p>${data.asset?.customer?.shippingAddress ?? ""}</p>
  <p>${data.serviceType?.name ?? ""} (${
    data.serviceType?.description ?? ""
  })</p>
  <p>${data.asset?.assetNumber ?? ""}</p>
  <p>${data.asset?.model ?? ""}</p>
  <p>${
    data.technician
      ? data.technician.firstName + " " + data.technician.lastName
      : ""
  }</p>
  <p>${data.workOrder ?? ""}</p>
  `;
};
