import puppeteer from "puppeteer";
import { getHtml } from "./functions";

export const getPDF = async (data: any, path: string) => {
  const invoicePdf: any = await getHtml(path, data);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-3d-apis",
      "--disable-accelerated-2d-canvas",
      "--disable-webgl",
      "--disable-accelerated-mjpeg-decode",
      "--disable-accelerated-video-decode",
      "--disable-gpu-compositing",
      "--disable-gl-drawing-for-tests",
      "--disable-vulkan",
    ],
    timeout: 60000,
    protocolTimeout: 240000,
    executablePath: "/usr/bin/chromium-browser",
  });
  const page = await browser.newPage();

  await page.setContent(invoicePdf);
  
  const pdfBuffer = await page.pdf({
    format: "letter",
  });

  await page.close();
  
  await browser.close();

  return pdfBuffer;
};
