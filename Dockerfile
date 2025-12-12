FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p data && if [ ! -f data/submissions.json ]; then echo "[]" > data/submissions.json; fi

EXPOSE 3000

CMD ["node", "server.js"]
