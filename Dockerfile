FROM node:lts-alpine AS builder 

WORKDIR /app

COPY tsconfig.json ./
COPY package*.json ./
COPY package-lock*.json ./

RUN npm ci && npm cache clean --force

COPY . .

RUN npm run build

FROM node:lts-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true    
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV QUICKBOOKS_AUTH_URL=https://appcenter.intuit.com/connect/oauth2
ENV QUICKBOOKS_REDIRECT_URI=https://portal.cofax.ca/settings

RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Run everything after as non-privileged user.
USER pptruser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder --chown=pptruser:pptruser /app/public ./public
COPY --from=builder /app/views ./dist/views

EXPOSE 4000

CMD [ "node", "dist/src/app.js" ]