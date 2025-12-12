FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN if [ ! -f submissions.json ]; then echo "[]" > submissions.json; fi

EXPOSE 3000

CMD ["node", "server.js"]
