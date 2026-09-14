# Etapa 1: Build
FROM node:20-alpine AS builder

# Instalar openssl y cliente de PostgreSQL (necesario para prisma)
RUN apk add --no-cache openssl postgresql-client

WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Copiar todo para instalación y compilación
COPY package*.json ./
COPY package-server.json ./
COPY tsconfig*.json ./
COPY . .

# Instalar todas las dependencias (incluye dev)
RUN chown -R node:node /app
RUN npm install

# Compilar TypeScript
RUN npm run build

# Etapa 2: Producción
FROM node:20-alpine

RUN apk add --no-cache openssl postgresql-client

WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar solo lo necesario desde build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/healthcheck.mjs ./scripts/healthcheck.mjs

# Crear logs
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production
ENV TZ=America/Guayaquil

CMD ["node", "dist-server/server/index.js"]

