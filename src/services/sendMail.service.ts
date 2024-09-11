import nodemailer from "nodemailer";
import Company from "../schema/companyInfo.schema";
import { ENVIRONMENT } from "../constant";
export interface ISMTP {
  hostEmail: string;
  hostPassword: string;
  host: string;
  name: string;
  hostPort: number;
}

const sendEmail = async (options: any, companyId?: string) => {
  const result: any | null = await Company.findOne({
    $or: [{ _id: companyId }, { name: "COFAX BUSINESS SYSTEMS INC" }],
  });

  const {
    hostEmail = process.env.EMAIL_USERNAME!,
    hostPassword = process.env.EMAIL_PASSWORD!,
    hostPort = 465,
    host = "smtp.zoho.com",
    name = "COFAX BUSINESS SYSTEMS INC",
  }: ISMTP = result;

  // const {
  //   hostEmail = process.env.EMAIL_USERNAME!,
  //   hostPassword = process.env.EMAIL_PASSWORD!,
  //   hostPort = 465,
  //   host = "smtp.zoho.com",
  //   name = "COFAX BUSINESS SYSTEMS INC",
  // } = {
  //   hostEmail: process.env.EMAIL_USERNAME!,
  //   hostPassword: process.env.EMAIL_PASSWORD!,
  //   hostPort: 465,
  //   host: "smtp.zoho.com",
  //   name: "COFAX BUSINESS SYSTEMS INC",
  // };

  // 1) Create a transporter
  const transporter = nodemailer.createTransport({
    host: host,
    port: hostPort,
    ignoreTLS: false,
    auth: {
      user: hostEmail,
      pass: hostPassword,
    },
    tls: { rejectUnauthorized: false },
  });

  // 2) Define the email options
  const mailOptions: any = {
    from: `"${name}" ${hostEmail}`,
    // to: options.email,//!Don't send mails to real customer while testing
    to:
      ENVIRONMENT === "development"
        ? "ritesh.benjwal@geeky.dev"
        : options.email,
    subject: options.subject,
    text: options.message,
    html: options.content,
  };
  if (options.attachments) mailOptions.attachments = options.attachments;

  // 3) Actually send the email
  await transporter.sendMail(mailOptions);
};

export const CreatePool = async (
  companyName = "COFAX BUSINESS SYSTEMS INC"
) => {
  const result: any | null = await Company.findOne({
    name: companyName,
  });

  const {
    hostEmail = "sourav.singh@geeky.dev",
    hostPassword = process.env.EMAIL_PASSWORD!,
    hostPort = 465,
    host = "smtp.zoho.com",
  }: ISMTP = result;

  // 1) Create a Pool
  const transporter = nodemailer.createTransport({
    host: host,
    port: hostPort,
    ignoreTLS: false,
    pool: true,
    auth: {
      user: hostEmail,
      pass: hostPassword,
    },
    tls: { rejectUnauthorized: false },
  });

  return { transporter, hostEmail, companyName };
};

export default sendEmail;
