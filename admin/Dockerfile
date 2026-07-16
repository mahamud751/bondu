FROM node:22-alpine AS dependencies
WORKDIR /workspace
COPY package*.json ./
RUN npm ci
FROM dependencies AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN npm run build
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/.next/standalone ./
COPY --from=build /workspace/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
