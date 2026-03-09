FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Exponer puertos
EXPOSE 3000 4001

# Ejecutar ambos servicios
CMD ["npm", "start"]
