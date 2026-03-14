FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Use example keys if api-keys.json doesn't exist (for fresh clones)
RUN if [ ! -f api-keys.json ]; then cp api-keys.example.json api-keys.json; fi

EXPOSE 3001

CMD ["npm", "start"]
