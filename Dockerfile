# Etapa 1: Build
FROM node:18-alpine AS builder

# Instalar openssl y cliente de PostgreSQL (necesario para prisma)
RUN apk add --no-cache openssl postgresql-client

WORKDIR /app

# Copiar todo para instalación y compilación
COPY package*.json ./
COPY package-server.json ./
COPY tsconfig*.json ./
COPY . .

# Instalar todas las dependencias (incluye dev)
RUN npm install

# Compilar TypeScript
RUN npm run build

# Etapa 2: Producción
FROM node:18-alpine

RUN apk add --no-cache openssl postgresql-client

WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar solo lo necesario desde build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env .env

# Crear logs
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "dist/server.js"]
