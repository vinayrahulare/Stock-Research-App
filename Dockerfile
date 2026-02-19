FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* .npmrc* ./ 2>/dev/null || true

RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]

