FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

COPY backend/ ./backend/

EXPOSE 3232

CMD ["node", "backend/src/server.js"]
